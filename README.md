# Themis4VSC

Themis4VSC integrates the Themis automated judge with Visual Studio Code. It lets you browse courses, submit assignments, view live submission results, and inspect test case input/output from inside the editor.

## Quick Start

1. Build the extension bundle:

```bash
pnpm run package
```

2. Create the VSIX package:

```bash
npx vsce package --out themis4vsc.vsix
```

3. Install the VSIX in VS Code (File → Install from VSIX...).

## Features

- Browse courses and assignments in the sidebar
- Submit files directly from the Explorer context menu
- Live submission updates via socket.io
- View test case input/output in a dedicated panel

## License

This project is provided as-is for personal use.

## Contact

Open an issue in the repository or contact the maintainer for support.
