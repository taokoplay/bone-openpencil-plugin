"use strict";

const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024;
const MAX_NODES = 10_000;
const MAX_STRING_LENGTH = 100_000;
const CONTAINER_TYPES = new Set([
  "document",
  "page",
  "frame",
  "group",
  "section",
  "component",
  "instance",
  "boolean",
]);
const PATCH_KEYS = new Set([
  "name",
  "x",
  "y",
  "width",
  "height",
  "fill",
  "stroke",
  "strokeWidth",
  "opacity",
  "cornerRadius",
  "visible",
  "content",
  "fontSize",
  "fontFamily",
  "layout",
  "padding",
  "gap",
  "alignItems",
  "justifyContent",
]);

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function boundedNumber(value, fallback, minimum, maximum) {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("number must be finite");
  if (value < minimum || value > maximum) throw new Error(`number must be between ${minimum} and ${maximum}`);
  return value;
}

function boundedString(value, fallback, label) {
  if (value === undefined) return fallback;
  if (typeof value !== "string") throw new Error(`${label} must be a string`);
  if (value.length > MAX_STRING_LENGTH) throw new Error(`${label} is too large`);
  return value;
}

function generatedId(prefix, rawPath) {
  return `${prefix}-${rawPath.replace(/[^a-zA-Z0-9_-]/g, "-")}`.replace(/-+/g, "-").slice(0, 96);
}

function normalizePage(raw, rawPath) {
  if (!isRecord(raw)) throw new Error(`page ${rawPath} must be an object`);
  if (raw.children !== undefined && !Array.isArray(raw.children)) {
    throw new Error(`page ${rawPath}.children must be an array`);
  }
  const children = Array.isArray(raw.children) ? raw.children : [];
  return {
    ...clone(raw),
    id: boundedString(raw.id, generatedId("page", rawPath), "page id"),
    name: boundedString(raw.name, "Page", "page name"),
    children: children.map((child, index) => normalizeNode(child, `${rawPath}.${index}`)),
  };
}

function rootCollections(document) {
  if (Array.isArray(document.pages) && document.pages.length > 0) {
    return document.pages.map((page, index) => ({
      container: page,
      pageIndex: index,
      children: Array.isArray(page.children) ? page.children : [],
    }));
  }
  return [{
    container: document,
    pageIndex: 0,
    children: Array.isArray(document.children) ? document.children : [],
  }];
}

function activeRootChildren(document, pageIndex = 0) {
  const collections = rootCollections(document);
  return collections[Math.max(0, Math.min(pageIndex, collections.length - 1))]?.children ?? [];
}

function walkNodes(document, visitor) {
  let count = 0;
  const visit = (node, parent, index, pageIndex) => {
    count += 1;
    if (count > MAX_NODES) throw new Error(`OpenPencil document exceeds the ${MAX_NODES} node limit`);
    visitor(node, parent, index, pageIndex);
    if (!Array.isArray(node.children)) return;
    node.children.forEach((child, childIndex) => visit(child, node, childIndex, pageIndex));
  };
  for (const collection of rootCollections(document)) {
    collection.children.forEach((node, index) => visit(node, collection.container, index, collection.pageIndex));
  }
}

function normalizeNode(raw, rawPath) {
  if (!isRecord(raw)) throw new Error(`node ${rawPath} must be an object`);
  const type = boundedString(raw.type, "frame", "node type");
  const id = boundedString(raw.id, generatedId("node", rawPath), "node id");
  const node = { ...clone(raw), id, type };
  node.name = boundedString(raw.name, type, "node name");
  node.x = boundedNumber(raw.x, 0, -1_000_000, 1_000_000);
  node.y = boundedNumber(raw.y, 0, -1_000_000, 1_000_000);
  node.width = boundedNumber(raw.width, 0, 0, 100_000);
  node.height = boundedNumber(raw.height, 0, 0, 100_000);
  if (raw.opacity !== undefined) node.opacity = boundedNumber(raw.opacity, 1, 0, 1);
  if (raw.children !== undefined) {
    if (!Array.isArray(raw.children)) throw new Error(`node ${rawPath}.children must be an array`);
    node.children = raw.children.map((child, index) => normalizeNode(child, `${rawPath}.${index}`));
  } else if (CONTAINER_TYPES.has(type)) {
    node.children = [];
  }
  return node;
}

function normalizeDocument(value) {
  if (!isRecord(value)) throw new Error("OpenPencil document must be an object");
  if (value.children !== undefined && !Array.isArray(value.children)) {
    throw new Error("OpenPencil document children must be an array");
  }
  if (value.pages !== undefined && !Array.isArray(value.pages)) {
    throw new Error("OpenPencil document pages must be an array");
  }
  const children = Array.isArray(value.children) ? value.children : [];
  const document = {
    ...clone(value),
    version: boundedString(value.version, "1.0.0", "document version"),
    children: children.map((child, index) => normalizeNode(child, `children.${index}`)),
  };
  if (Array.isArray(value.pages)) {
    document.pages = value.pages.map((page, index) => normalizePage(page, `pages.${index}`));
  }
  const ids = new Set();
  walkNodes(document, (node) => {
    if (ids.has(node.id)) throw new Error(`duplicate OpenPencil node id: ${node.id}`);
    ids.add(node.id);
  });
  return document;
}

function parseDocumentText(text) {
  if (typeof text !== "string") throw new Error("OpenPencil document text must be a string");
  if (Buffer.byteLength(text, "utf8") > MAX_DOCUMENT_BYTES) {
    throw new Error(`OpenPencil document exceeds ${MAX_DOCUMENT_BYTES} bytes`);
  }
  let value;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid OpenPencil JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  return normalizeDocument(value);
}

function serializeDocument(document) {
  const normalized = normalizeDocument(document);
  const text = `${JSON.stringify(normalized, null, 2)}\n`;
  if (Buffer.byteLength(text, "utf8") > MAX_DOCUMENT_BYTES) {
    throw new Error(`OpenPencil document exceeds ${MAX_DOCUMENT_BYTES} bytes`);
  }
  return text;
}

function countNodes(document) {
  let count = 0;
  walkNodes(document, () => { count += 1; });
  return count;
}

function findNode(document, nodeId) {
  if (typeof nodeId !== "string" || nodeId.length === 0) return undefined;
  let found;
  walkNodes(document, (node) => {
    if (node.id === nodeId) found = node;
  });
  return found;
}

function findNodeLocation(document, nodeId) {
  let result;
  walkNodes(document, (node, parent, index) => {
    if (node.id === nodeId) result = { node, parent, index };
  });
  return result;
}

function summaryOf(document) {
  const frames = [];
  let nodeCount = 0;
  const roots = new Set(rootCollections(document).flatMap((collection) => collection.children));
  walkNodes(document, (node, _parent, _index, pageIndex) => {
    nodeCount += 1;
    if (roots.has(node)) {
      frames.push({
        id: node.id,
        name: node.name,
        type: node.type,
        pageIndex,
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
      });
    }
  });
  return {
    version: document.version,
    pageCount: rootCollections(document).length,
    frameCount: frames.length,
    nodeCount,
    frames,
  };
}

function assertRelativeOpPath(rawPath) {
  if (typeof rawPath !== "string" || rawPath.trim() === "") throw new Error("path must be a non-empty string");
  const path = rawPath.trim().replace(/\\/g, "/");
  if (path.startsWith("/") || /^[A-Za-z]:\//.test(path) || path.startsWith("//")) {
    throw new Error("path must be relative to the workspace");
  }
  const parts = path.split("/").filter(Boolean);
  if (parts.some((part) => part === ".." || part === ".")) throw new Error("path contains an invalid traversal segment");
  if (!path.toLowerCase().endsWith(".op")) throw new Error("path must end in .op");
  return parts.join("/");
}

function createDocument(options = {}) {
  const name = boundedString(options.name, "OpenPencil frame", "name").trim() || "OpenPencil frame";
  const width = boundedNumber(options.width, 1440, 1, 100_000);
  const height = boundedNumber(options.height, 900, 1, 100_000);
  const fill = boundedString(options.fill, "#ffffff", "fill").trim() || "#ffffff";
  const id = generatedId("frame", `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);
  return normalizeDocument({
    version: "0.8.6",
    pages: [{
      id: generatedId("page", `${Date.now().toString(36)}-1`),
      name: "Page 1",
      children: [{
        id,
        type: "frame",
        name,
        x: 0,
        y: 0,
        width,
        height,
        fill: [{ type: "solid", color: fill }],
        children: [],
      }],
    }],
    children: [],
  });
}

function validatePatch(patch) {
  if (!isRecord(patch)) throw new Error("patch must be an object");
  const next = {};
  for (const [key, value] of Object.entries(patch)) {
    if (!PATCH_KEYS.has(key)) throw new Error(`patch field is not editable: ${key}`);
    if (["x", "y"].includes(key)) next[key] = boundedNumber(value, 0, -1_000_000, 1_000_000);
    else if (["width", "height", "strokeWidth", "cornerRadius", "gap"].includes(key)) next[key] = boundedNumber(value, 0, 0, 100_000);
    else if (key === "opacity") next[key] = boundedNumber(value, 1, 0, 1);
    else if (["name", "content", "fontFamily", "layout", "alignItems", "justifyContent"].includes(key)) next[key] = boundedString(value, "", key);
    else next[key] = clone(value);
  }
  return next;
}

function applyNodePatch(document, nodeId, patch) {
  const location = findNodeLocation(document, nodeId);
  if (!location) throw new Error(`node not found: ${nodeId}`);
  Object.assign(location.node, validatePatch(patch));
  return document;
}

function applyOperations(document, operations) {
  if (!Array.isArray(operations) || operations.length === 0) throw new Error("operations must be a non-empty array");
  for (const operation of operations) {
    if (!isRecord(operation) || typeof operation.op !== "string") throw new Error("each operation needs an op");
    if (operation.op === "update") {
      applyNodePatch(document, operation.nodeId, operation.patch);
      continue;
    }
    if (operation.op === "add") {
      const parent = operation.parentId ? findNode(document, operation.parentId) : rootCollections(document)[0].container;
      if (!parent || (parent !== document && !CONTAINER_TYPES.has(parent.type) && !Array.isArray(parent.children))) throw new Error("add parent must be a container");
      if (!Array.isArray(parent.children)) parent.children = [];
      const node = normalizeNode(operation.node, `added.${parent.children.length}`);
      if (findNode(document, node.id)) throw new Error(`node id already exists: ${node.id}`);
      const index = operation.index === undefined ? parent.children.length : boundedNumber(operation.index, 0, 0, parent.children.length);
      parent.children.splice(Math.trunc(index), 0, node);
      continue;
    }
    if (operation.op === "remove") {
      const location = findNodeLocation(document, operation.nodeId);
      if (!location) throw new Error(`node not found: ${operation.nodeId}`);
      location.parent.children.splice(location.index, 1);
      continue;
    }
    throw new Error(`unsupported OpenPencil operation: ${operation.op}`);
  }
  return normalizeDocument(document);
}

function inspectNode(document, nodeId) {
  const node = findNode(document, nodeId);
  if (!node) throw new Error(`node not found: ${nodeId}`);
  return clone(node);
}

module.exports = {
  MAX_DOCUMENT_BYTES,
  MAX_NODES,
  assertRelativeOpPath,
  applyNodePatch,
  applyOperations,
  countNodes,
  createDocument,
  findNode,
  inspectNode,
  normalizeDocument,
  parseDocumentText,
  serializeDocument,
  summaryOf,
};
