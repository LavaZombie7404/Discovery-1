import { world, system } from "@minecraft/server";

/**
 * Discovery-1 - Minecraft Bedrock Scripting Project
 */

// Called when a player spawns
world.afterEvents.playerSpawn.subscribe((event) => {
  if (event.initialSpawn) {
    event.player.sendMessage("§aWelcome to Discovery-1!");
  }
});

// Main game loop
function mainTick() {
  if (system.currentTick % 200 === 0) {
    // Runs every 10 seconds (200 ticks)
    world.sendMessage("§7[Discovery-1] Tick: " + system.currentTick);
  }

  system.run(mainTick);
}

system.run(mainTick);
