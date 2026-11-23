"use strict";

const {
  assertRelativeOpPath,
  applyNodePatch,
  applyOperations,
  createDocument,
  inspectNode,
  parseDocumentText,
  serializeDocument,
  summaryOf,
} = require("./document.js");

const TOOLS = {
  render: "openpencil_render",
  selection: "openpencil_selection",
  create: "openpencil_new",
  edit: "openpencil_edit",
};
const CHANNELS = new Set([
  "op.workspace",
  "op.list",
  "op.read",
  "op.create",
  "op.write",
  "op.patch",
]);
const MAX_LIST_RESULTS = 500;

function failure(code, message) {
  const error = new Error(message || code);
  error.code = code;
  return error;
}

function errorResult(error) {
  return {
    ok: false,
    code: typeof error?.code === "string" ? error.code : "INTERNAL",
    message: error instanceof Error ? error.message : String(error),
  };
}

function ensureWorkspacePath(payload, workspace) {
  if (payload?.workspacePath !== undefined && payload.workspacePath !== workspace?.path) {
    throw failure("WORKSPACE_CHANGED", "The workspace changed while OpenPencil was loading");
  }
}

async function currentWorkspace() {
  const workspace = await pi.workspace.get();
  if (!workspace?.path) throw failure("NO_WORKSPACE", "Open a project before using OpenPencil");
  return workspace;
}

function pathOf(value) {
  return assertRelativeOpPath(value);
}

async function readPath(path) {
  const text = await pi.fs.readText(path);
  const document = parseDocumentText(text);
  return { path, document, text, summary: summaryOf(document) };
}

async function assertDoesNotExist(path) {
  try {
    await pi.fs.stat(path);
  } catch (error) {
    const code = typeof error?.code === "string" ? error.code : "";
    if (["NOT_FOUND", "ENOENT", "FILE_NOT_FOUND"].includes(code)) return;
    throw error;
  }
  throw failure("ALREADY_EXISTS", `OpenPencil target already exists: ${path}`);
}

async function listDocuments(payload) {
  const patterns = ["*.op", "**/*.op"];
  const paths = new Set();
  for (const pattern of patterns) {
    const matches = await pi.fs.glob(pattern);
    if (!Array.isArray(matches)) continue;
    for (const match of matches) {
      try {
        paths.add(pathOf(match));
      } catch {
        // The host already filters the scope; malformed matches are ignored.
      }
      if (paths.size >= MAX_LIST_RESULTS) break;
    }
    if (paths.size >= MAX_LIST_RESULTS) break;
  }
  return {
    workspacePath: payload.workspacePath,
    files: [...paths].sort((left, right) => left.localeCompare(right)),
    truncated: paths.size >= MAX_LIST_RESULTS,
  };
}

async function createDocumentAt(payload) {
  const path = pathOf(payload.path);
  await assertDoesNotExist(path);
  const document = createDocument(payload);
  const text = serializeDocument(document);
  await pi.fs.writeText(path, text);
  return { path, created: true, summary: summaryOf(document), document };
}

async function writeDocument(payload) {
  const path = pathOf(payload.path);
  let document;
  if (payload.document !== undefined) document = parseDocumentText(JSON.stringify(payload.document));
  else if (typeof payload.text === "string") document = parseDocumentText(payload.text);
  else throw failure("INVALID_ARGUMENT", "op.write needs document or text");
  const text = serializeDocument(document);
  await pi.fs.writeText(path, text);
  return { path, saved: true, summary: summaryOf(document), document };
}

async function patchDocument(payload) {
  const path = pathOf(payload.path);
  const current = await readPath(path);
  let document = current.document;
  if (Array.isArray(payload.operations) && payload.operations.length > 0) {
    document = applyOperations(document, payload.operations);
  } else if (typeof payload.nodeId === "string" && payload.patch !== undefined) {
    document = applyNodePatch(document, payload.nodeId, payload.patch);
  } else {
    throw failure("INVALID_ARGUMENT", "op.patch needs operations or nodeId + patch");
  }
  const text = serializeDocument(document);
  await pi.fs.writeText(path, text);
  return { path, saved: true, summary: summaryOf(document), document };
}

async function invoke(channel, payload) {
  const workspace = await currentWorkspace();
  if (channel !== "op.workspace") ensureWorkspacePath(payload, workspace);
  if (channel === "op.workspace") return workspace;
  if (channel === "op.list") return listDocuments(payload);
  if (channel === "op.read") return readPath(pathOf(payload.path));
  if (channel === "op.create") return createDocumentAt(payload);
  if (channel === "op.write") return writeDocument(payload);
  if (channel === "op.patch") return patchDocument(payload);
  throw failure("UNSUPPORTED", `Unknown OpenPencil channel: ${channel}`);
}

async function inspectTool(args) {
  if (args?.action !== "inspect") throw failure("INVALID_ARGUMENT", "openpencil_render only supports action=inspect");
  const path = pathOf(args.path);
  const result = await readPath(path);
  return {
    kind: "openpencil-document",
    path,
    summary: result.summary,
    document: result.document,
    note: "The PI-Desktop port returns structured document data and renders it in the OpenPencil work panel.",
  };
}

async function selectionTool(args) {
  if (args?.action !== "inspect") throw failure("INVALID_ARGUMENT", "openpencil_selection only supports action=inspect");
  const path = pathOf(args.path);
  const result = await readPath(path);
  return { path, node: inspectNode(result.document, args.nodeId), summary: result.summary };
}

async function createTool(args) {
  const workspace = await currentWorkspace();
  return createDocumentAt({ ...args, workspacePath: workspace.path });
}

async function editTool(args) {
  const workspace = await currentWorkspace();
  return patchDocument({ ...args, workspacePath: workspace.path });
}

async function onLoad() {
  await pi.commands.register({
    id: "bone.openpencil.open",
    title: "Bone OpenPencil: Open Canvas",
    keywords: ["openpencil", "canvas", "design", "op"],
    run: async () => {
      try {
        await pi.ui.revealView({ viewId: "canvas" });
      } catch (error) {
        await pi.ui.showToast(`Bone OpenPencil: ${error instanceof Error ? error.message : String(error)}`, "error");
      }
    },
  });

  await pi.agent.registerTool({
    name: TOOLS.render,
    description: "Inspect an existing OpenPencil .op document and return its structured frame and node summary.",
    risk: "low",
    planSafeActions: ["inspect"],
    schema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["inspect"] },
        path: { type: "string" },
      },
      required: ["action", "path"],
    },
    execute: inspectTool,
  });

  await pi.agent.registerTool({
    name: TOOLS.selection,
    description: "Read one node from an OpenPencil .op document by id.",
    risk: "low",
    planSafeActions: ["inspect"],
    schema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["inspect"] },
        path: { type: "string" },
        nodeId: { type: "string" },
      },
      required: ["action", "path", "nodeId"],
    },
    execute: selectionTool,
  });

  await pi.agent.registerTool({
    name: TOOLS.create,
    description: "Create an OpenPencil .op document with one frame. Existing files are never overwritten.",
    risk: "high",
    schema: {
      type: "object",
      properties: {
        path: { type: "string" },
        name: { type: "string" },
        width: { type: "number" },
        height: { type: "number" },
        fill: { type: "string" },
      },
      required: ["path"],
    },
    execute: createTool,
  });

  await pi.agent.registerTool({
    name: TOOLS.edit,
    description: "Apply bounded updates or add/remove operations to an OpenPencil .op document.",
    risk: "high",
    schema: {
      type: "object",
      properties: {
        path: { type: "string" },
        nodeId: { type: "string" },
        patch: { type: "object" },
        operations: { type: "array", items: { type: "object" } },
      },
      required: ["path"],
    },
    execute: editTool,
  });
}

async function onUnload() {
  for (const name of Object.values(TOOLS)) {
    await pi.agent.unregisterTool(name).catch(() => {});
  }
  await pi.commands.unregister("bone.openpencil.open").catch(() => {});
}

async function onPanelInvoke(channel, payload = {}) {
  if (!CHANNELS.has(channel)) return { ok: false, code: "UNSUPPORTED", message: `Unknown channel: ${channel}` };
  try {
    return await invoke(channel, payload);
  } catch (error) {
    return errorResult(error);
  }
}

module.exports = {
  onLoad,
  onUnload,
  onPanelInvoke,
  internals: {
    assertRelativeOpPath,
    createDocument,
    parseDocumentText,
    serializeDocument,
    summaryOf,
  },
};
