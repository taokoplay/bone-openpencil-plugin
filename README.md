# Bone OpenPencil for PI-Desktop

Bone OpenPencil is a PI-Desktop port of the DSH OpenPencil plugin
[`ZSeven-W/dsh-openpencil`](https://github.com/ZSeven-W/dsh-openpencil). The
source plugin connects DeepSeek Harness (DSH) with OpenPencil. This project
repackages that design-document workflow for the PI-Desktop plugin runtime.

- Plugin id: `bone.openpencil`
- Display name: **Bone OpenPencil**
- Ported plugin: **DSH OpenPencil** (`@zseven-w/dsh-openpencil`)
- Upstream package line: `0.1.0-rc.15`
- DSH source commit: `5665008`
- OpenPencil compatibility target: `v0.8.6` (`c939f85`)
- License: MIT; see [`LICENSE`](LICENSE)
- Detailed provenance and compatibility notes: [`UPSTREAM.md`](UPSTREAM.md)
- Migration design: [`docs/MIGRATION.md`](docs/MIGRATION.md)

## What this plugin provides

Bone OpenPencil adds a right-side **Bone OpenPencil Canvas** work-panel view.
It lists workspace-relative `.op` files, reads current canonical `pages[].children` documents and legacy top-level `children` documents, renders the selected page and common nodes as a local SVG canvas, supports node selection and bounded property edits, and saves through PI-Desktop's host-gated `fs.writeText` API.

The Agent receives four tools:

- `openpencil_render` — inspect a document and return bounded frame/node data;
- `openpencil_selection` — inspect one node by id;
- `openpencil_new` — create a document with one frame;
- `openpencil_edit` — apply bounded node updates or `update` / `add` /
  `remove` operations.

The `openpencil_*` tool names and `.op` format names remain unchanged because
they describe the upstream OpenPencil contract. The plugin identity and host
command use the Bone namespace.

## How the port works

The port follows the current OpenPencil `.op` JSON contract while retaining
legacy top-level `children` compatibility. OpenPencil v0.8.6 uses canonical
`pages[].children` data; unknown document and node fields are preserved during
read/write. The port replaces DSH-only Cordis services, conversation tool cards,
managed editor daemons, viewer asset routes, and native render binaries with
PI-Desktop's public plugin APIs:

| DSH OpenPencil capability | Bone OpenPencil implementation |
| --- | --- |
| DSH Cordis plugin entry | PI-Desktop CommonJS plugin entry (`main.js`) |
| DSH conversation tool cards | PI-Desktop Agent tools (`pi.agent.registerTool`) |
| DSH client renderer | Sandboxed Work Panel view over `window.pluginBridge` |
| DSH session/file services | PI-Desktop `pi.workspace` and `pi.fs` APIs |
| DSH managed editor daemon | Local editable SVG canvas and explicit Save |
| Native OpenPencil pixel renderer | Structured document inspection and local SVG preview |

The local SVG preview is intended for inspection and editing. It does not claim
pixel-export parity with DSH's optional native OpenPencil renderer.

## Security and file scope

The plugin reads and writes only workspace-relative `*.op` files covered by the
manifest's `*.op` and `**/*.op` scopes. It rejects absolute paths, `.` / `..`
traversal, non-`.op` targets, duplicate node ids, non-finite geometry,
documents larger than 4 MiB, and documents with more than 10,000 nodes.

The plugin view never receives the injected `pi` object and never imports Node
or Electron modules. All workspace actions go through `window.pluginBridge`
and the plugin process re-checks the workspace identity before file operations.
The high-risk permissions `agent.tool.register`, `agent.prompt.inject`, and
`fs.write` require the normal PI-Desktop user grant.

## Development and installation

Load this directory with **Plugins → Load development plugin**, or install the
packaged artifact:

```bash
pnpm pi-plugin check /path/to/bone-openpencil-plugin
pnpm pi-plugin pack /path/to/bone-openpencil-plugin
```

The generated package is `dist/bone.openpencil-0.2.0.piplug`.

The plugin has no npm runtime dependencies. Its direct runtime files are
`manifest.json`, `main.js`, `document.js`, `views/index.html`, the skill,
license, and provenance documents.

## Source attribution

This plugin is derived from the **DSH OpenPencil plugin**, not directly from
the OpenPencil editor repository. The OpenPencil repository is the upstream
format/editor reference; `ZSeven-W/dsh-openpencil` is the plugin being ported.
See [`UPSTREAM.md`](UPSTREAM.md) for the exact repositories, commit, copied
asset, license, and the boundary between reused behavior and PI-Desktop
reimplementation.
