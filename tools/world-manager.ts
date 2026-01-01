/**
 * Minecraft Bedrock World Manager
 * Programmatically create and configure worlds without GUI interaction
 */

import * as fs from "fs";
import * as path from "path";
const nbt = require("prismarine-nbt");

// Minecraft Bedrock data location
const MC_DATA_PATH = path.join(
  process.env.APPDATA || "",
  "Minecraft Bedrock"
);

interface WorldConfig {
  name: string;
  gameType: number; // 0=survival, 1=creative, 2=adventure
  difficulty: number; // 0=peaceful, 1=easy, 2=normal, 3=hard
  cheatsEnabled: boolean;
  commandsEnabled: boolean;
  experiments: {
    betaApis?: boolean;
    dataDrivernItems?: boolean;
    gametest?: boolean;
  };
  behaviorPacks: Array<{ uuid: string; version: [number, number, number] }>;
  resourcePacks: Array<{ uuid: string; version: [number, number, number] }>;
  flatWorld?: boolean;
}

/**
 * Find the Minecraft user folder
 */
export async function findMinecraftUserFolder(): Promise<string> {
  const usersPath = path.join(MC_DATA_PATH, "Users");
  if (!fs.existsSync(usersPath)) {
    throw new Error(`Minecraft data not found at ${usersPath}`);
  }

  const users = fs.readdirSync(usersPath).filter((f) => {
    const stat = fs.statSync(path.join(usersPath, f));
    return stat.isDirectory() && f !== "." && f !== "..";
  });

  if (users.length === 0) {
    throw new Error("No Minecraft user folders found");
  }

  // Return first user folder
  return path.join(usersPath, users[0], "games", "com.mojang");
}

/**
 * List all worlds
 */
export async function listWorlds(): Promise<
  Array<{ id: string; name: string; path: string }>
> {
  const comMojang = await findMinecraftUserFolder();
  const worldsPath = path.join(comMojang, "minecraftWorlds");

  if (!fs.existsSync(worldsPath)) {
    return [];
  }

  const worlds = [];
  for (const dir of fs.readdirSync(worldsPath)) {
    const worldPath = path.join(worldsPath, dir);
    const levelNamePath = path.join(worldPath, "levelname.txt");

    if (fs.existsSync(levelNamePath)) {
      const name = fs.readFileSync(levelNamePath, "utf-8").trim();
      worlds.push({ id: dir, name, path: worldPath });
    }
  }

  return worlds;
}

/**
 * Read level.dat from a world
 */
export async function readLevelDat(worldPath: string): Promise<any> {
  const levelDatPath = path.join(worldPath, "level.dat");
  const buffer = fs.readFileSync(levelDatPath);

  // Bedrock level.dat has 8-byte header (version + length)
  const version = buffer.readInt32LE(0);
  const length = buffer.readInt32LE(4);
  const nbtData = buffer.slice(8, 8 + length);

  const result = await nbt.parse(nbtData, "little");
  return { version, parsed: result.parsed };
}

/**
 * Write level.dat to a world
 */
export async function writeLevelDat(
  worldPath: string,
  data: any,
  version: number = 10
): Promise<void> {
  const nbtBuffer = nbt.writeUncompressed(data, "little");

  // Create header + NBT data
  const header = Buffer.alloc(8);
  header.writeInt32LE(version, 0);
  header.writeInt32LE(nbtBuffer.length, 4);

  const fullBuffer = Buffer.concat([header, nbtBuffer]);
  fs.writeFileSync(path.join(worldPath, "level.dat"), fullBuffer);
}

/**
 * Configure behavior packs for a world
 */
export function setWorldBehaviorPacks(
  worldPath: string,
  packs: Array<{ uuid: string; version: [number, number, number] }>
): void {
  const config = packs.map((p) => ({
    pack_id: p.uuid,
    version: p.version,
  }));

  fs.writeFileSync(
    path.join(worldPath, "world_behavior_packs.json"),
    JSON.stringify(config, null, "\t")
  );
}

/**
 * Configure resource packs for a world
 */
export function setWorldResourcePacks(
  worldPath: string,
  packs: Array<{ uuid: string; version: [number, number, number] }>
): void {
  const config = packs.map((p) => ({
    pack_id: p.uuid,
    version: p.version,
  }));

  fs.writeFileSync(
    path.join(worldPath, "world_resource_packs.json"),
    JSON.stringify(config, null, "\t")
  );
}

/**
 * Enable cheats and commands in an existing world
 */
export async function enableCheats(worldPath: string): Promise<void> {
  const levelDatPath = path.join(worldPath, "level.dat");
  const buffer = fs.readFileSync(levelDatPath);

  // Simple binary patch for cheatsEnabled and commandsEnabled
  // Find and set the byte after each setting name to 0x01
  let data = Buffer.from(buffer);

  const patches = [
    { name: "cheatsEnabled", offset: 13 },
    { name: "commandsEnabled", offset: 15 },
  ];

  for (const patch of patches) {
    const idx = data.indexOf(patch.name);
    if (idx !== -1) {
      // The value byte is right after the name
      data[idx + patch.offset] = 0x01;
      console.log(`Patched ${patch.name} to true at offset ${idx}`);
    }
  }

  fs.writeFileSync(levelDatPath, data);
}

/**
 * Create a new world with specified configuration
 */
export async function createWorld(config: WorldConfig): Promise<string> {
  const comMojang = await findMinecraftUserFolder();
  const worldsPath = path.join(comMojang, "minecraftWorlds");

  // Generate unique world ID
  const worldId = Buffer.from(Date.now().toString())
    .toString("base64")
    .replace(/[/+=]/g, "")
    .slice(0, 12);
  const worldPath = path.join(worldsPath, worldId);

  // Create world folder structure
  fs.mkdirSync(worldPath, { recursive: true });
  fs.mkdirSync(path.join(worldPath, "db"), { recursive: true });
  fs.mkdirSync(path.join(worldPath, "behavior_packs"), { recursive: true });
  fs.mkdirSync(path.join(worldPath, "resource_packs"), { recursive: true });

  // Write levelname.txt
  fs.writeFileSync(path.join(worldPath, "levelname.txt"), config.name);

  // Set behavior packs
  setWorldBehaviorPacks(worldPath, config.behaviorPacks);

  // Set resource packs
  setWorldResourcePacks(worldPath, config.resourcePacks);

  // Write empty history files
  fs.writeFileSync(
    path.join(worldPath, "world_behavior_pack_history.json"),
    "[]"
  );
  fs.writeFileSync(
    path.join(worldPath, "world_resource_pack_history.json"),
    "[]"
  );

  console.log(`Created world folder: ${worldPath}`);
  console.log(
    `Note: level.dat must be created by Minecraft on first load, or copied from a template.`
  );

  return worldPath;
}

/**
 * Copy an existing world as template and modify it
 */
export async function cloneAndConfigureWorld(
  sourceWorldPath: string,
  config: WorldConfig
): Promise<string> {
  const comMojang = await findMinecraftUserFolder();
  const worldsPath = path.join(comMojang, "minecraftWorlds");

  // Generate unique world ID
  const worldId =
    "SRTM_" +
    Buffer.from(Date.now().toString())
      .toString("base64")
      .replace(/[/+=]/g, "")
      .slice(0, 8);
  const worldPath = path.join(worldsPath, worldId);

  // Copy world folder
  fs.cpSync(sourceWorldPath, worldPath, { recursive: true });

  // Update levelname
  fs.writeFileSync(path.join(worldPath, "levelname.txt"), config.name);

  // Update behavior packs
  setWorldBehaviorPacks(worldPath, config.behaviorPacks);

  // Update resource packs
  setWorldResourcePacks(worldPath, config.resourcePacks);

  // Enable cheats
  await enableCheats(worldPath);

  console.log(`Cloned and configured world: ${worldPath}`);
  return worldPath;
}

// CLI
if (require.main === module) {
  (async () => {
    const command = process.argv[2];

    switch (command) {
      case "list":
        const worlds = await listWorlds();
        console.log("Worlds:");
        for (const w of worlds) {
          console.log(`  ${w.name} (${w.id})`);
        }
        break;

      case "read":
        const worldPath = process.argv[3];
        if (!worldPath) {
          console.log("Usage: world-manager read <world-path>");
          break;
        }
        const levelData = await readLevelDat(worldPath);
        console.log(JSON.stringify(levelData.parsed, null, 2).slice(0, 5000));
        break;

      case "enable-cheats":
        const targetWorld = process.argv[3];
        if (!targetWorld) {
          console.log("Usage: world-manager enable-cheats <world-path>");
          break;
        }
        await enableCheats(targetWorld);
        console.log("Cheats enabled");
        break;

      case "create-srtm":
        // Create SRTM terrain world
        const existingWorlds = await listWorlds();
        if (existingWorlds.length === 0) {
          console.log("No existing worlds to use as template");
          break;
        }

        const srtmConfig: WorldConfig = {
          name: "SRTM Moldova Terrain",
          gameType: 1, // Creative
          difficulty: 0, // Peaceful
          cheatsEnabled: true,
          commandsEnabled: true,
          experiments: { betaApis: true },
          behaviorPacks: [
            { uuid: "d1e2f3a4-b5c6-4d7e-8f9a-0b1c2d3e4f5a", version: [1, 0, 0] }, // Moldova Terrain
            { uuid: "a409d006-b745-4d21-a7b9-26b2afcf9090", version: [1, 0, 0] }, // Discovery-1
          ],
          resourcePacks: [
            { uuid: "f1e2d3c4-b5a6-4798-8a9b-0c1d2e3f4a5b", version: [1, 0, 0] }, // Discovery-1 resources
          ],
        };

        const newWorldPath = await cloneAndConfigureWorld(
          existingWorlds[0].path,
          srtmConfig
        );
        console.log(`Created SRTM world: ${newWorldPath}`);
        break;

      default:
        console.log("Minecraft Bedrock World Manager");
        console.log("");
        console.log("Commands:");
        console.log("  list                    - List all worlds");
        console.log("  read <world-path>       - Read world settings");
        console.log("  enable-cheats <path>    - Enable cheats in world");
        console.log("  create-srtm             - Create SRTM terrain world");
    }
  })();
}
