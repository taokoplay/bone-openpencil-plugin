# Upstream and porting provenance

## Direct source plugin

Bone OpenPencil is ported from the **DSH OpenPencil plugin**:

- Repository: https://github.com/ZSeven-W/dsh-openpencil
- Package: `@zseven-w/dsh-openpencil`
- Upstream package line: `0.1.0-rc.15`
- Source commit: `5665008`
- Commit subject: `fix(runtime): treat workspace-linked npm/<platform> as development package until staged`
- License: MIT

This direct source relationship matters: Bone OpenPencil is a PI-Desktop port
of `dsh-openpencil`, which itself is the DSH integration layer for OpenPencil.
It is not presented as an official OpenPencil distribution.

## Related format/editor project

The `.op` document format and editor concepts come from OpenPencil:

- Repository: https://github.com/ZSeven-W/openpencil

The OpenPencil repository is recorded as the related format/editor reference.
The plugin being ported is `ZSeven-W/dsh-openpencil`.

## What was reused

The port retains the parts that are useful and stable across hosts:

- the `.op` JSON document shape (`version`, top-level `children`, node ids,
  geometry, fills, and nested children);
- the design-oriented inspection/editing workflow;
- the names and intent of the `openpencil_*` Agent tools;
- the OpenPencil design skill concepts;
- the upstream OpenPencil logo as `icon.png`.

## What was reimplemented for PI-Desktop

The DSH host contract is not available in PI-Desktop, so these parts were
replaced:

| Upstream DSH surface | Bone OpenPencil port |
| --- | --- |
| Cordis `apply(ctx)` entry | CommonJS `onLoad` / `onUnload` plugin entry |
| `@deepseek-ai/dsh-tools` | `pi.agent.registerTool` |
| DSH tool-call presentation metadata | `contributes.views` Work Panel view |
| DSH client React tool cards | Sandboxed HTML/SVG view using `window.pluginBridge` |
| DSH session/file/sandbox services | `pi.workspace`, `pi.fs`, and manifest file scopes |
| Managed OpenPencil editor daemon | Local SVG inspector/editor with explicit Save |
| DSH Web Server routes and signed capabilities | PI-Desktop plugin bridge channels |
| Native OpenPencil/Jian render binaries | Structured inspection and local SVG preview |

## Deliberate compatibility limits

The port does not include DSH conversation cards, DSH Cordis lifecycle
services, DSH session hydration, DSH managed editor processes, DSH MCP
presentation routes, native pixel-perfect export, or DSH collaboration
bootstrap behavior. These would require DSH host services and are outside the
PI-Desktop plugin contract.

## License and asset attribution

The plugin ships the upstream MIT `LICENSE`. `icon.png` was copied from
`dsh-openpencil/docs/images/dsh-openpencil-logo.png`. The Bone OpenPencil
adapter code and PI-Desktop view integration are maintained as this plugin's
porting work under the surrounding project's licensing policy.
