@echo off
echo Updating ELO parameters...

wrangler d1 execute nrl-elo --remote --command ^
"UPDATE parameters SET value = CASE name ^
    WHEN 'k_factor' THEN 9.455 ^
    WHEN 'home_advantage' THEN 40 ^
    WHEN 'travel_per1000km' THEN 15 ^
    WHEN 'rest_per_round' THEN 3 ^
    WHEN 'streak_pts' THEN 2.5 ^
    WHEN 'reversion_weight' THEN 3 ^
    WHEN 'early_boost' THEN 0.95 ^
END;"

echo Done.
pause