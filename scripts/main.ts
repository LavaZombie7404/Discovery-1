import { world, system, Player } from "@minecraft/server";

/**
 * Discovery-1 - Minecraft Bedrock Scripting Project
 * By LavaZombie7404
 */

// Banner lines with fire gradient colors
const BANNER = [
  "§8§m                                                  §r",
  "",
  "  §6§l🔥 §c█░░ §6█▀█ §e█░█ §a█▀█ §b▀▀█ §9█▀█ §d█▄█ §c█▀▄ §6█ §e█▀▀ §6§l🔥",
  "  §6§l   §c█░░ §6█▀█ §e▀▄▀ §a█▀█ §b▄▀░ §9█░█ §d█░█ §c█▀▄ §6█ §e█▀▀",
  "  §6§l   §c▀▀▀ §6▀░▀ §e░▀░ §a▀░▀ §b▀▀▀ §9▀▀▀ §d▀░▀ §c▀▀░ §6▀ §e▀▀▀",
  "",
  "         §e§l✦ §6§lL A V A Z O M B I E 7 4 0 4 §e§l✦",
  "",
  "  §8§m                                                  §r",
  "",
  "      §b§lDISCOVERY-1 §r§7» §fExplore. Create. Conquer.",
  "",
  "§8§m                                                  §r",
];

/**
 * Shows the welcome banner to a player
 */
function showBanner(player: Player): void {
  for (const line of BANNER) {
    player.sendMessage(line);
  }
  player.playSound("random.levelup");
}

// Called when a player spawns
world.afterEvents.playerSpawn.subscribe((event) => {
  if (event.initialSpawn) {
    // Delay banner slightly for dramatic effect
    system.runTimeout(() => {
      showBanner(event.player);
    }, 20); // 1 second delay
  }
});

// Main game loop (remove tick spam, keep for future use)
function mainTick() {
  system.run(mainTick);
}

system.run(mainTick);
