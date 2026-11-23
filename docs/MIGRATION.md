# Bone OpenPencil migration notes

## Purpose

This document explains exactly what was migrated into Bone OpenPencil and what
was intentionally left behind. It prevents the plugin from being mistaken for
a direct copy of the DSH runtime or an official OpenPencil desktop build.

## Source chain

```text
OpenPencil editor / .op format
        ↓
ZSeven-W/dsh-openpencil
        ↓
Bone OpenPencil (`bone.openpencil`)
        ↓
PI-Desktop Work Panel + Agent tools
```

The direct source plugin is `ZSeven-W/dsh-openpencil`. OpenPencil is the
related format/editor project that the source plugin drives.

## Porting decisions

### Kept

- `.op` documents remain JSON documents with `version` and nested `children`.
- Node ids, geometry, names, fills, and nested child relationships are kept.
- Agent-facing tool intent remains recognizable through the `openpencil_*`
  names.
- The design skill still recommends inspect-before-edit and preserving stable
  node ids.
- The upstream OpenPencil logo is retained with MIT attribution.

### Adapted

- DSH tool registration became `pi.agent.registerTool`.
- DSH's conversation presentation became a `ui.view` Work Panel view.
- DSH's host file service became `pi.workspace` plus `pi.fs` under manifest
  scopes.
- The managed editor became an in-panel SVG renderer with node selection,
  property editing, and explicit Save.
- DSH's signed HTTP capability routes became plugin-owned `op.*` bridge
  channels, with the workspace identity checked before each operation.
- DSH's runtime-specific dependency tree was removed; the plugin ships direct
  CommonJS, HTML, JSON, SVG, and Markdown resources.

### Not included

- DSH Cordis services and lifecycle fibers;
- DSH conversation tool cards and presentation metadata;
- DSH session hydration and historical card recovery;
- the managed `op-host-web-server` editor daemon;
- OpenPencil/Jian native pixel rendering and exact PNG export;
- DSH MCP routes, signed browser capabilities, and collaboration bootstrap.

Those features depend on DSH or native OpenPencil host services and are not
silently represented as supported by this PI-Desktop plugin.

## Runtime contract

The plugin id is `bone.openpencil`, while the document/tool vocabulary remains
`OpenPencil` because it names the upstream format and API concepts. The host
command is `bone.openpencil.open`; the four Agent tools retain their
`openpencil_*` names for semantic compatibility.

The plugin requests:

- `ui.view` for the right-side canvas;
- `agent.tool.register` for the four Agent tools;
- `agent.prompt.inject` for the design skill;
- `fs.read` and `fs.write` scoped to workspace-relative `*.op` files.

## Verification

The target package must pass:

```bash
pnpm pi-plugin check /path/to/bone-openpencil-plugin
pnpm pi-plugin pack /path/to/bone-openpencil-plugin
```

The source repository contains the contract test for the document model and
plugin-process create/read/edit/save/unload round trip. A real Electron visual
journey remains a separate UI E2E concern.
