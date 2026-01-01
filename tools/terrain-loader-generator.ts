/**
 * Terrain Loader Generator - Creates efficient /fill-based terrain loader
 * Uses fill commands for faster generation instead of individual setblocks
 */

import * as fs from "fs";
import * as path from "path";
import { SRTMParser, BoundingBox } from "./srtm-parser";

interface TerrainConfig {
  scale: number;
  baseY: number;
  bbox: BoundingBox;
  downsample: number; // Additional downsampling factor
}

interface HeightMap {
  width: number;
  length: number;
  heights: number[][];
  minY: number;
  maxY: number;
}

/**
 * Generate heightmap from elevation data
 */
function generateHeightmap(
  parser: SRTMParser,
  config: TerrainConfig
): HeightMap {
  const bbox = config.bbox;

  // Calculate dimensions
  const arcSecond = 1 / 3600;
  const step = arcSecond * config.downsample;
  const width = Math.ceil((bbox.east - bbox.west) / step);
  const length = Math.ceil((bbox.north - bbox.south) / step);

  console.log(`Generating heightmap: ${width} x ${length}`);

  const heights: number[][] = [];
  let minElev = Infinity;
  let maxElev = -Infinity;

  for (let z = 0; z < length; z++) {
    const row: number[] = [];
    for (let x = 0; x < width; x++) {
      const lat = bbox.north - z * step;
      const lon = bbox.west + x * step;

      try {
        const elev = parser.getElevation(lat, lon);
        if (elev > -1000) {
          minElev = Math.min(minElev, elev);
          maxElev = Math.max(maxElev, elev);
        }
        row.push(elev > -1000 ? elev : 0);
      } catch {
        row.push(0);
      }
    }
    heights.push(row);
  }

  // Convert to Y coordinates
  const yHeights = heights.map((row) =>
    row.map((elev) =>
      config.baseY + Math.round((elev - minElev) / config.scale)
    )
  );

  const minY = config.baseY;
  const maxY = config.baseY + Math.ceil((maxElev - minElev) / config.scale);

  console.log(`Elevation: ${minElev.toFixed(0)}m to ${maxElev.toFixed(0)}m`);
  console.log(`Y range: ${minY} to ${maxY}`);

  return { width, length, heights: yHeights, minY, maxY };
}

/**
 * Generate fill commands for a chunk of terrain
 */
function generateChunkCommands(
  heightmap: HeightMap,
  startX: number,
  startZ: number,
  chunkSize: number
): string[] {
  const commands: string[] = [];

  const endX = Math.min(startX + chunkSize, heightmap.width);
  const endZ = Math.min(startZ + chunkSize, heightmap.length);

  // For each column, fill from bedrock to surface
  for (let z = startZ; z < endZ; z++) {
    // Try to batch adjacent columns with same height
    let runStart = startX;
    let runHeight = heightmap.heights[z][startX];

    for (let x = startX + 1; x <= endX; x++) {
      const height = x < endX ? heightmap.heights[z][x] : -1;

      if (height !== runHeight || x === endX) {
        // End of run, emit fill command
        const runEnd = x - 1;

        // Fill stone base
        commands.push(
          `fill ~${runStart} ~${heightmap.minY - 4} ~${z} ~${runEnd} ~${runHeight - 4} ~${z} stone`
        );

        // Fill dirt layer
        commands.push(
          `fill ~${runStart} ~${runHeight - 3} ~${z} ~${runEnd} ~${runHeight - 1} ~${z} dirt`
        );

        // Fill grass surface
        commands.push(
          `fill ~${runStart} ~${runHeight} ~${z} ~${runEnd} ~${runHeight} ~${z} grass_block`
        );

        runStart = x;
        runHeight = height;
      }
    }
  }

  return commands;
}

/**
 * Generate all terrain loader functions
 */
function generateLoaderFunctions(
  heightmap: HeightMap,
  outputDir: string,
  chunkSize: number = 16
): void {
  const chunksX = Math.ceil(heightmap.width / chunkSize);
  const chunksZ = Math.ceil(heightmap.length / chunkSize);
  const totalChunks = chunksX * chunksZ;

  console.log(`Generating ${totalChunks} chunk loaders (${chunksX} x ${chunksZ})`);

  // Create functions directory
  const functionsDir = path.join(outputDir, "functions", "terrain");
  if (!fs.existsSync(functionsDir)) {
    fs.mkdirSync(functionsDir, { recursive: true });
  }

  // Generate individual chunk functions
  const chunkNames: string[] = [];
  let chunkIndex = 0;

  for (let cz = 0; cz < chunksZ; cz++) {
    for (let cx = 0; cx < chunksX; cx++) {
      const startX = cx * chunkSize;
      const startZ = cz * chunkSize;

      const commands = generateChunkCommands(heightmap, startX, startZ, chunkSize);
      const chunkName = `chunk_${cx}_${cz}`;
      chunkNames.push(chunkName);

      const content = commands.join("\n");
      fs.writeFileSync(path.join(functionsDir, `${chunkName}.mcfunction`), content);

      chunkIndex++;
      if (chunkIndex % 100 === 0) {
        console.log(`  Generated ${chunkIndex}/${totalChunks} chunks`);
      }
    }
  }

  // Generate master loader that calls chunks in sequence
  const loaderCommands = [
    `# Moldova Terrain Loader`,
    `# Generated from SRTM elevation data`,
    `# Size: ${heightmap.width} x ${heightmap.length} blocks`,
    `# Run this function from where you want the terrain origin`,
    ``,
    `say Loading Moldova terrain (${totalChunks} chunks)...`,
    ``,
  ];

  // Add chunk calls (they'll run relative to execution position)
  for (const name of chunkNames) {
    loaderCommands.push(`function terrain/${name}`);
  }

  loaderCommands.push(``, `say Terrain generation complete!`);

  fs.writeFileSync(
    path.join(outputDir, "functions", "load_terrain.mcfunction"),
    loaderCommands.join("\n")
  );

  // Generate row-by-row loaders for progressive loading
  for (let cz = 0; cz < chunksZ; cz++) {
    const rowCommands = [`# Row ${cz + 1} of ${chunksZ}`];
    for (let cx = 0; cx < chunksX; cx++) {
      rowCommands.push(`function terrain/chunk_${cx}_${cz}`);
    }
    fs.writeFileSync(
      path.join(functionsDir, `row_${cz}.mcfunction`),
      rowCommands.join("\n")
    );
  }

  // Generate a row loader
  const rowLoaderCommands = [
    `# Progressive row loader - run multiple times`,
    `# Each run loads one row of the terrain`,
    ``,
    ...Array.from({ length: chunksZ }, (_, i) =>
      `execute if score terrain_row loader matches ${i} run function terrain/row_${i}`
    ),
    ``,
    `scoreboard players add terrain_row loader 1`,
    `execute if score terrain_row loader matches ${chunksZ}.. run say Terrain complete!`,
    `execute if score terrain_row loader matches ${chunksZ}.. run scoreboard players set terrain_row loader 0`,
  ];

  fs.writeFileSync(
    path.join(outputDir, "functions", "load_terrain_row.mcfunction"),
    rowLoaderCommands.join("\n")
  );

  // Generate setup function
  const setupCommands = [
    `# Run this once before using load_terrain_row`,
    `scoreboard objectives add loader dummy`,
    `scoreboard players set terrain_row loader 0`,
    `say Terrain loader initialized. Run /function load_terrain_row repeatedly.`,
  ];

  fs.writeFileSync(
    path.join(outputDir, "functions", "setup_terrain.mcfunction"),
    setupCommands.join("\n")
  );

  console.log(`Generated loader functions in ${functionsDir}`);
}

// CLI
if (require.main === module) {
  const dataDir = path.join(__dirname, "../data/srtm");
  const outputDir = path.join(__dirname, "../behavior_packs/discovery");

  const config: TerrainConfig = {
    scale: 30,
    baseY: 64,
    downsample: 4, // 1 block per 4 SRTM samples (~120m per block)
    bbox: {
      west: 28.546326,
      east: 29.068520,
      south: 46.923556,
      north: 47.086272,
    },
  };

  console.log("=== Terrain Loader Generator ===");
  console.log(`Scale: 1:${config.scale * config.downsample} effective`);
  console.log(`Downsample: ${config.downsample}x`);
  console.log();

  const parser = new SRTMParser(dataDir);

  // Load required tiles
  console.log("Loading SRTM tiles...");
  parser.loadTile("N46E028");
  parser.loadTile("N46E029");
  parser.loadTile("N47E028");
  parser.loadTile("N47E029");

  console.log();

  // Generate heightmap
  const heightmap = generateHeightmap(parser, config);

  console.log();

  // Generate loader functions
  generateLoaderFunctions(heightmap, outputDir, 16);

  console.log();
  console.log("=== Usage ===");
  console.log("1. Rebuild the pack: npm run build");
  console.log("2. In Minecraft, run: /function setup_terrain");
  console.log("3. Stand where you want terrain origin");
  console.log("4. Run: /function load_terrain (all at once)");
  console.log("   Or: /function load_terrain_row (progressive)");
}
