/**
 * Terrain Generator - Converts SRTM elevation data to Minecraft terrain
 * Scale 1:30 (1 block = 30 real-world meters)
 */

import * as fs from "fs";
import * as path from "path";
import { SRTMParser, BoundingBox, ElevationData } from "./srtm-parser";

export interface TerrainConfig {
  scale: number; // 1 block = N meters
  baseY: number; // Minecraft Y level for minimum elevation
  waterLevel: number; // Real-world water level in meters
  bbox: BoundingBox;
}

export interface BlockData {
  x: number;
  y: number;
  z: number;
  block: string;
}

export interface TerrainResult {
  blocks: BlockData[];
  width: number;
  length: number;
  minY: number;
  maxY: number;
  blockCount: number;
}

/**
 * Determines block type based on elevation and position
 */
function getBlockType(elevation: number, surfaceY: number, y: number): string {
  if (y === surfaceY) {
    // Surface block
    if (elevation < 50) return "minecraft:grass_block";
    if (elevation < 150) return "minecraft:grass_block";
    if (elevation < 250) return "minecraft:coarse_dirt";
    return "minecraft:stone";
  } else if (y >= surfaceY - 3) {
    // Near-surface layers
    return "minecraft:dirt";
  } else {
    // Deep underground
    return "minecraft:stone";
  }
}

/**
 * Generate Minecraft terrain from elevation data
 */
export function generateTerrain(
  elevation: ElevationData,
  config: TerrainConfig
): TerrainResult {
  const blocks: BlockData[] = [];

  // At 1:30 scale, we downsample the elevation data
  // SRTM1 is ~30m resolution, so at 1:30 scale, 1 sample ≈ 1 block
  const sampleStep = Math.max(1, Math.floor(config.scale / 30));

  const width = Math.ceil(elevation.width / sampleStep);
  const length = Math.ceil(elevation.height / sampleStep);

  console.log(`Generating terrain: ${width} x ${length} blocks`);
  console.log(`Sample step: ${sampleStep}, Scale: 1:${config.scale}`);

  // Calculate Y scaling
  // At 1:30, 30m = 1 block, so elevation range maps to Y range
  const elevRange = elevation.maxElevation - elevation.minElevation;
  const yRange = Math.ceil(elevRange / config.scale);

  console.log(`Elevation range: ${elevation.minElevation}m to ${elevation.maxElevation}m (${elevRange}m)`);
  console.log(`Y range: ${yRange} blocks (base Y: ${config.baseY})`);

  let minY = Infinity;
  let maxY = -Infinity;

  // Generate blocks
  for (let z = 0; z < length; z++) {
    for (let x = 0; x < width; x++) {
      // Sample elevation at this position
      const srcRow = Math.min(z * sampleStep, elevation.height - 1);
      const srcCol = Math.min(x * sampleStep, elevation.width - 1);
      const elev = elevation.data[srcRow * elevation.width + srcCol];

      // Skip NODATA
      if (elev <= -1000) continue;

      // Calculate surface Y
      const surfaceY = config.baseY + Math.round((elev - elevation.minElevation) / config.scale);

      minY = Math.min(minY, surfaceY);
      maxY = Math.max(maxY, surfaceY);

      // Generate column of blocks (surface + some depth)
      const depth = 4; // Blocks of depth below surface
      for (let dy = 0; dy <= depth; dy++) {
        const y = surfaceY - dy;
        if (y < 0) continue;

        blocks.push({
          x,
          y,
          z,
          block: getBlockType(elev, surfaceY, y),
        });
      }
    }

    // Progress indicator
    if (z % 50 === 0) {
      console.log(`  Progress: ${Math.round((z / length) * 100)}%`);
    }
  }

  console.log(`Generated ${blocks.length} blocks`);
  console.log(`Y range: ${minY} to ${maxY}`);

  return {
    blocks,
    width,
    length,
    minY,
    maxY,
    blockCount: blocks.length,
  };
}

/**
 * Export terrain as .mcfunction file for easy import
 */
export function exportAsMcfunction(
  terrain: TerrainResult,
  outputPath: string,
  chunkSize: number = 10000
): string[] {
  const files: string[] = [];

  // Split into multiple files if needed (Minecraft has limits)
  const chunks = Math.ceil(terrain.blocks.length / chunkSize);

  for (let i = 0; i < chunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, terrain.blocks.length);
    const chunkBlocks = terrain.blocks.slice(start, end);

    const fileName = chunks > 1
      ? `${path.basename(outputPath, '.mcfunction')}_${i + 1}.mcfunction`
      : path.basename(outputPath);
    const filePath = path.join(path.dirname(outputPath), fileName);

    const lines = chunkBlocks.map(b =>
      `setblock ~${b.x} ~${b.y} ~${b.z} ${b.block}`
    );

    fs.writeFileSync(filePath, lines.join('\n'));
    files.push(filePath);
    console.log(`Wrote ${filePath} (${chunkBlocks.length} blocks)`);
  }

  return files;
}

/**
 * Export terrain as JSON structure (for structure blocks)
 */
export function exportAsStructureJson(
  terrain: TerrainResult,
  outputPath: string
): void {
  const structure = {
    format_version: "1.20.0",
    size: [terrain.width, terrain.maxY - terrain.minY + 5, terrain.length],
    origin: [0, terrain.minY, 0],
    blocks: terrain.blocks.map(b => ({
      pos: [b.x, b.y, b.z],
      block: b.block,
    })),
  };

  fs.writeFileSync(outputPath, JSON.stringify(structure, null, 2));
  console.log(`Wrote structure JSON: ${outputPath}`);
}

// CLI
if (require.main === module) {
  const dataDir = path.join(__dirname, "../data/srtm");
  const outputDir = path.join(__dirname, "../data/terrain");

  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const config: TerrainConfig = {
    scale: 30, // 1:30
    baseY: 64, // Sea level in Minecraft
    waterLevel: 0,
    bbox: {
      west: 28.546326,
      east: 29.068520,
      south: 46.923556,
      north: 47.086272,
    },
  };

  console.log("=== Terrain Generator ===");
  console.log(`Scale: 1:${config.scale}`);
  console.log(`BBox: ${config.bbox.west},${config.bbox.south} to ${config.bbox.east},${config.bbox.north}`);
  console.log();

  // Load elevation data
  const parser = new SRTMParser(dataDir);
  const elevation = parser.loadBoundingBox(config.bbox);

  // Generate terrain
  console.log();
  const terrain = generateTerrain(elevation, config);

  // Export
  console.log();
  console.log("=== Exporting ===");

  // Export as mcfunction
  const mcfunctionPath = path.join(outputDir, "moldova_terrain.mcfunction");
  exportAsMcfunction(terrain, mcfunctionPath);

  // Export as JSON
  const jsonPath = path.join(outputDir, "moldova_terrain.json");
  exportAsStructureJson(terrain, jsonPath);

  console.log();
  console.log("=== Summary ===");
  console.log(`  Terrain size: ${terrain.width} x ${terrain.length} blocks`);
  console.log(`  Height range: Y${terrain.minY} to Y${terrain.maxY}`);
  console.log(`  Total blocks: ${terrain.blockCount.toLocaleString()}`);
  console.log();
  console.log("To import in Minecraft, copy the .mcfunction file to:");
  console.log("  behavior_packs/discovery/functions/");
  console.log("Then run: /function moldova_terrain");
}
