#!/usr/bin/env bash
# Convert every JPG > 100KB under assets/ to webp (quality 80, method 6).
# Keeps the original alongside so we can manually verify before deleting.

QUALITY=80
THRESHOLD_KB=10

total_before=0
total_after=0
count=0

while IFS= read -r -d '' src; do
  before=$(stat -f%z "$src")
  total_before=$((total_before + before))

  # strip whichever extension is present, then add .webp
  base="${src%.jpeg}"
  base="${base%.jpg}"
  dst="${base}.webp"

  if [[ -f "$dst" ]]; then
    echo "  skip (exists): $dst"
    continue
  fi

  if ! cwebp -q "$QUALITY" -m 6 -mt -quiet "$src" -o "$dst"; then
    echo "  FAILED: $src" >&2
    continue
  fi

  after=$(stat -f%z "$dst")
  total_after=$((total_after + after))
  count=$((count + 1))

  before_kb=$(awk "BEGIN{printf \"%.0f\", $before/1024}")
  after_kb=$(awk "BEGIN{printf \"%.0f\", $after/1024}")
  printf "  %-65s %4s KB -> %4s KB\n" "${src#assets/}" "$before_kb" "$after_kb"

done < <(find assets -type f \( -name "*.jpg" -o -name "*.jpeg" \) -size "+${THRESHOLD_KB}k" -print0 | sort -z)

echo "---"
total_before_kb=$(awk "BEGIN{printf \"%.1f\", $total_before/1024/1024}")
total_after_kb=$(awk "BEGIN{printf \"%.1f\", $total_after/1024/1024}")
echo "converted $count files: ${total_before_kb} MB -> ${total_after_kb} MB"
