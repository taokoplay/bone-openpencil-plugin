---
name: OpenPencil design workflow
description: Use when creating, inspecting, or editing OpenPencil .op design documents in PI-Desktop.
---

# Bone OpenPencil in PI-Desktop

OpenPencil v0.8.6 documents are JSON files with a `version` and canonical `pages[].children`. Legacy files may use top-level `children`; Bone OpenPencil reads both forms. Each node has a stable `id`, a `type`, geometry, optional fills, and optional `children`.

Use the Bone OpenPencil tools with a workspace-relative `.op` path. Inspect the page selected in the work panel before editing:

- `openpencil_render` with `action: "inspect"` reads a document and returns bounded frame and node metadata.
- `openpencil_selection` with `action: "inspect"` reads one node by id.
- `openpencil_new` creates one new document and never overwrites an existing target.
- `openpencil_edit` applies a bounded node patch or a small ordered list of `update`, `add`, and `remove` operations.

When the user asks to review a design, inspect before editing. Preserve existing node ids and document fields that are unrelated to the requested change. Keep coordinates and dimensions finite and within the document's visible frame. Use the OpenPencil work panel for visual confirmation after a write.

The PI-Desktop port provides a local editable SVG preview and structured Agent tools. It does not expose DSH conversation cards, DSH Cordis services, a managed DSH editor daemon, or the optional native pixel exporter.
