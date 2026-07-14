#!/usr/bin/env bash
# Minimal status line command that does nothing but keep
# ~/.claude/rate-limit-cache.json fresh for the soomfon-claude-usage plugin.
#
# If you already have a custom status line, don't use this file directly —
# instead copy the cache-writing bit into your own script (see README.md).
#
# Wire this up in ~/.claude/settings.json:
#   "statusLine": { "type": "command", "command": "bash ~/.claude/statusline-command.sh" }

set -u

read -r input

now=$(date +%s)

mapfile -t F < <(jq -n -r --arg input "$input" '
  ($input | fromjson) as $j
  | [
      ($j.rate_limits.five_hour.used_percentage as $x
        | if $x == null then "" else (100 - $x | tostring) end),
      ($j.rate_limits.seven_day.used_percentage as $x
        | if $x == null then "" else (100 - $x | tostring) end),
      ($j.rate_limits.five_hour.resets_at as $x
        | if $x == null then "" else ($x | tostring) end),
      ($j.rate_limits.seven_day.resets_at as $x
        | if $x == null then "" else ($x | tostring) end)
    ]
  | .[]')
CR=$'\r'
F=("${F[@]%"$CR"}")

five_left=${F[0]-}; seven_left=${F[1]-}
five_reset=${F[2]-}; seven_reset=${F[3]-}

printf '{"generatedAt":%s,"fiveHourLeftPct":%s,"sevenDayLeftPct":%s,"fiveHourResetsAt":%s,"sevenDayResetsAt":%s}\n' \
  "$now" "${five_left:-null}" "${seven_left:-null}" "${five_reset:-null}" "${seven_reset:-null}" \
  > "$HOME/.claude/rate-limit-cache.json"

# Print something minimal so Claude Code's status line isn't blank.
if [[ -n $five_left ]]; then
  printf '5h %.0f%% left' "$five_left"
fi
