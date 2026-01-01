/**
 * SRTM Elevation Data Parser
 * Parses .hgt files (SRTM1 format: 3601x3601 signed 16-bit big-endian)
 */

import * as fs from "fs";
import * as path from "path";

export interface BoundingBox {
  west: number;
  east: number;
  south: number;
  north: number;
}

export interface ElevationData {
  width: number;
  height: number;
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
  minElevation: number;
  maxElevation: number;
  data: Int16Array;
  getElevation(lat: number, lon: number): number;
}

export class SRTMParser {
  private tiles: Map<string, Int16Array> = new Map();
  private dataDir: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
  }

  /**
   * Get tile name from coordinates
   */
  private getTileName(lat: number, lon: number): string {
    const latPrefix = lat >= 0 ? "N" : "S";
    const lonPrefix = lon >= 0 ? "E" : "W";
    const latNum = Math.floor(Math.abs(lat)).toString().padStart(2, "0");
    const lonNum = Math.floor(Math.abs(lon)).toString().padStart(3, "0");
    return `${latPrefix}${latNum}${lonPrefix}${lonNum}`;
  }

  /**
   * Load a single SRTM tile
   */
  loadTile(tileName: string): Int16Array {
    if (this.tiles.has(tileName)) {
      return this.tiles.get(tileName)!;
    }

    const filePath = path.join(this.dataDir, `${tileName}.hgt`);
    if (!fs.existsSync(filePath)) {
      throw new Error(`SRTM tile not found: ${filePath}`);
    }

    const buffer = fs.readFileSync(filePath);
    const samples = 3601; // SRTM1
    const data = new Int16Array(samples * samples);

    // Parse big-endian 16-bit signed integers
    for (let i = 0; i < data.length; i++) {
      data[i] = buffer.readInt16BE(i * 2);
    }

    this.tiles.set(tileName, data);
    console.log(`Loaded tile ${tileName}: ${samples}x${samples} samples`);
    return data;
  }

  /**
   * Get elevation at a specific lat/lon
   */
  getElevation(lat: number, lon: number): number {
    const tileName = this.getTileName(lat, lon);
    const tile = this.loadTile(tileName);

    const samples = 3601;
    const tileLat = Math.floor(lat);
    const tileLon = Math.floor(lon);

    // Calculate position within tile
    const latOffset = lat - tileLat;
    const lonOffset = lon - tileLon;

    // Row 0 is at the top (north), column 0 is at the left (west)
    const row = Math.floor((1 - latOffset) * (samples - 1));
    const col = Math.floor(lonOffset * (samples - 1));

    const idx = row * samples + col;
    const elevation = tile[idx];

    // -32768 is NODATA
    return elevation === -32768 ? 0 : elevation;
  }

  /**
   * Load elevation data for a bounding box
   */
  loadBoundingBox(bbox: BoundingBox): ElevationData {
    // Determine which tiles we need
    const minTileLat = Math.floor(bbox.south);
    const maxTileLat = Math.floor(bbox.north);
    const minTileLon = Math.floor(bbox.west);
    const maxTileLon = Math.floor(bbox.east);

    // Load all required tiles
    for (let lat = minTileLat; lat <= maxTileLat; lat++) {
      for (let lon = minTileLon; lon <= maxTileLon; lon++) {
        const tileName = this.getTileName(lat, lon);
        try {
          this.loadTile(tileName);
        } catch (e) {
          console.warn(`Warning: Could not load tile ${tileName}`);
        }
      }
    }

    // Calculate output dimensions based on SRTM resolution
    const arcSecond = 1 / 3600; // ~30m at equator
    const width = Math.ceil((bbox.east - bbox.west) / arcSecond);
    const height = Math.ceil((bbox.north - bbox.south) / arcSecond);

    console.log(`Bounding box: ${width}x${height} samples`);

    // Extract elevation data
    const data = new Int16Array(width * height);
    let minElev = Infinity;
    let maxElev = -Infinity;

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const lat = bbox.north - row * arcSecond;
        const lon = bbox.west + col * arcSecond;

        try {
          const elev = this.getElevation(lat, lon);
          data[row * width + col] = elev;
          if (elev > -1000) {
            minElev = Math.min(minElev, elev);
            maxElev = Math.max(maxElev, elev);
          }
        } catch {
          data[row * width + col] = 0;
        }
      }
    }

    console.log(`Elevation range: ${minElev}m to ${maxElev}m`);

    return {
      width,
      height,
      minLat: bbox.south,
      maxLat: bbox.north,
      minLon: bbox.west,
      maxLon: bbox.east,
      minElevation: minElev,
      maxElevation: maxElev,
      data,
      getElevation: (lat: number, lon: number) => this.getElevation(lat, lon),
    };
  }
}

// CLI test
if (require.main === module) {
  const dataDir = path.join(__dirname, "../data/srtm");
  const parser = new SRTMParser(dataDir);

  const bbox: BoundingBox = {
    west: 28.546326,
    east: 29.068520,
    south: 46.923556,
    north: 47.086272,
  };

  console.log("Loading SRTM data for Moldova region...");
  console.log(`BBox: ${bbox.west},${bbox.south} to ${bbox.east},${bbox.north}`);

  const elevation = parser.loadBoundingBox(bbox);

  console.log(`\nResults:`);
  console.log(`  Size: ${elevation.width} x ${elevation.height}`);
  console.log(`  Elevation: ${elevation.minElevation}m to ${elevation.maxElevation}m`);

  // Test a specific point
  const testLat = 47.0;
  const testLon = 28.8;
  console.log(`\n  Test point (${testLat}, ${testLon}): ${parser.getElevation(testLat, testLon)}m`);
}
