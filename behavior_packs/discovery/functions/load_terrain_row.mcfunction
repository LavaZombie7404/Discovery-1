# Progressive row loader - run multiple times
# Each run loads one row of the terrain

execute if score terrain_row loader matches 0 run function terrain/row_0
execute if score terrain_row loader matches 1 run function terrain/row_1
execute if score terrain_row loader matches 2 run function terrain/row_2
execute if score terrain_row loader matches 3 run function terrain/row_3
execute if score terrain_row loader matches 4 run function terrain/row_4
execute if score terrain_row loader matches 5 run function terrain/row_5
execute if score terrain_row loader matches 6 run function terrain/row_6
execute if score terrain_row loader matches 7 run function terrain/row_7
execute if score terrain_row loader matches 8 run function terrain/row_8
execute if score terrain_row loader matches 9 run function terrain/row_9

scoreboard players add terrain_row loader 1
execute if score terrain_row loader matches 10.. run say Terrain complete!
execute if score terrain_row loader matches 10.. run scoreboard players set terrain_row loader 0