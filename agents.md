# Discovery-1 Development Guide

## Agent Permissions

Claude can run these commands automatically when needed:
- `npm run local-deploy -- --watch` - Start hot-reload development server
- `npm run build` - Compile TypeScript
- `npm run lint` - Check code quality
- `npx just-scripts mcaddon` - Create distributable package
- VS Code debugger control for debugging scripts

## Language Recommendation: TypeScript vs C++

### Recommendation: TypeScript

For Minecraft Bedrock development, **TypeScript is the clear choice**. Here's why:

| Factor | TypeScript | C++ |
|--------|-----------|-----|
| **Official Support** | Fully supported via Scripting API | Not available for content creators |
| **Documentation** | Extensive Microsoft docs | N/A |
| **Debugging** | VS Code debugger integration | N/A |
| **Community** | Active, growing ecosystem | N/A |
| **Learning Curve** | Moderate | N/A |

**Important:** C++ is NOT available for Minecraft Bedrock content creation. Unlike Java Edition modding, Bedrock Edition does not expose C++ APIs to developers. C++ is only used internally by Mojang for the game engine.

## Development Stack

### Required Tools
- **Node.js** (LTS version): https://nodejs.org/
- **Visual Studio Code**: https://code.visualstudio.com/
- **Minecraft Bedrock Edition** (Windows 10/11)

### VS Code Extensions
- Minecraft Debugger
- Blockception's Minecraft Bedrock Development

### Starter Template
```bash
# Clone Microsoft's starter project
git clone https://github.com/microsoft/minecraft-scripting-samples.git
# Use the ts-starter folder
```

## Project Structure

```
Discovery-1/
├── behavior_packs/
│   └── discovery/
│       ├── manifest.json
│       └── scripts/
│           └── main.ts
├── resource_packs/
│   └── discovery/
│       └── manifest.json
├── scripts/           # Source TypeScript
├── .env              # Configuration
├── package.json
└── agents.md         # This file
```

## Configuration (.env)

```env
PROJECT_NAME="discovery"
MINECRAFT_PRODUCT="BedrockUWP"
CUSTOM_DEPLOYMENT_PATH=""
```

**MINECRAFT_PRODUCT options:**
- `BedrockUWP` - Standard Minecraft Bedrock
- `PreviewUWP` - Minecraft Preview (beta features)
- `Custom` - Custom installation path

## Build Commands

```bash
# Install dependencies
npm install

# Deploy to Minecraft (one-time)
npx just-scripts local-deploy

# Watch mode (auto-deploy on save)
npx just-scripts local-deploy --watch

# Lint code
npx just-scripts lint
npx just-scripts lint --fix

# Create .mcaddon package
npx just-scripts mcaddon
```

## Debugging Setup

### Enable Content Log
1. Open Minecraft Settings
2. Go to Creator section
3. Enable "Content Log File"
4. Enable "Content Log GUI"

### VS Code Debugging
1. Install "Minecraft Debugger" extension
2. Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "minecraft-js",
      "request": "attach",
      "name": "Attach to Minecraft",
      "mode": "listen",
      "localRoot": "${workspaceFolder}/scripts",
      "port": 19144
    }
  ]
}
```

3. In Minecraft, use command: `/script debugger connect localhost 19144`
4. Set breakpoints in VS Code and debug

### Debug Commands (In-Game)
```
/script debugger connect localhost 19144  # Connect debugger
/reload                                    # Reload scripts
/script profiler start                     # Start profiler
/script profiler stop                      # Stop profiler
```

## Scripting API Overview

### Core Modules
```typescript
import { world, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
```

### Basic Script Example
```typescript
import { world, system } from "@minecraft/server";

// Run every tick (20 times/second)
system.runInterval(() => {
  // Game logic here
}, 1);

// Listen for events
world.afterEvents.playerSpawn.subscribe((event) => {
  const player = event.player;
  player.sendMessage("Welcome to Discovery-1!");
});

// Chat commands
world.beforeEvents.chatSend.subscribe((event) => {
  if (event.message.startsWith("!")) {
    event.cancel = true;
    // Handle custom command
  }
});
```

## Documentation References

- [Minecraft Creator Portal](https://learn.microsoft.com/en-us/minecraft/creator/)
- [Scripting API Reference](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/)
- [Bedrock Samples](https://github.com/microsoft/minecraft-scripting-samples)
- [Add-On Development](https://learn.microsoft.com/en-us/minecraft/creator/documents/gettingstarted)

## Development Workflow

1. **Write code** in TypeScript (`.ts` files)
2. **Build** - TypeScript compiles to JavaScript
3. **Deploy** - Scripts copy to Minecraft behavior pack folder
4. **Test** - Load world with behavior pack enabled
5. **Debug** - Use VS Code debugger + in-game logs
6. **Iterate** - Use watch mode for rapid development

## com.mojang Paths

Scripts deploy to:
```
%LOCALAPPDATA%\Packages\Microsoft.MinecraftUWP_8wekyb3d8bbwe\LocalState\games\com.mojang\development_behavior_packs\
```

## Tips

- Always use `--watch` mode during development
- Use `/reload` to reload scripts without restarting world
- Check content log for errors (Ctrl+H in-game)
- TypeScript provides type safety for Minecraft APIs
- Test on Minecraft Preview for latest API features

## Zero-Touch Automation (No GUI Clicks)

Claude can fully automate Minecraft world setup without any GUI interaction.

### World Manager Tool

Located at `tools/world-manager.ts`:

```bash
# List all worlds
npx ts-node tools/world-manager.ts list

# Create SRTM terrain world with all settings
npx ts-node tools/world-manager.ts create-srtm

# Enable cheats in existing world
npx ts-node tools/world-manager.ts enable-cheats <world-path>
```

### Key Files for Automation

| File | Purpose |
|------|---------|
| `levelname.txt` | World display name |
| `world_behavior_packs.json` | Behavior packs to load |
| `world_resource_packs.json` | Resource packs to load |
| `level.dat` | World settings (binary NBT) |

### Enabling Cheats Programmatically

The `level.dat` file contains settings like `cheatsEnabled` and `commandsEnabled`.
Use `world-manager.ts enable-cheats` to patch these values.

### Adding Behavior Packs to World

```json
// world_behavior_packs.json
[
  {
    "pack_id": "uuid-of-behavior-pack",
    "version": [1, 0, 0]
  }
]
```

### Creating Worlds

1. Clone an existing world as template
2. Update `levelname.txt`
3. Configure `world_behavior_packs.json`
4. Patch `level.dat` for cheats/settings
5. Restart Minecraft

### com.mojang Location (This Installation)

**IMPORTANT:** This uses Minecraft Bedrock Launcher (not UWP Store version).

```
%APPDATA%\Minecraft Bedrock\Users\<USER_ID>\games\com.mojang\
```

### Pack Locations

```
com.mojang/
├── behavior_packs/              # Installed behavior packs
├── development_behavior_packs/  # Development packs (hot reload)
├── resource_packs/              # Installed resource packs
├── development_resource_packs/  # Development resource packs
└── minecraftWorlds/             # World saves
```
