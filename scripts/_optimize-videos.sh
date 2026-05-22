#!/usr/bin/env bash
# Re-encode every video > 1MB under assets/works to H.264 CRF 24 (high
# quality, web-friendly). Originals are copied to BACKUP_DIR first so the
# operation is reversible if a clip looks degraded.
#
# .mov files are re-muxed to .mp4 (web-friendlier); callers must update
# the HTML reference manually after the script reports the rename.

BACKUP_DIR="/tmp/portfolio-backup-originals"
mkdir -p "$BACKUP_DIR"

total_before=0
total_after=0

while IFS= read -r -d '' src; do
  filename=$(basename "$src")
  before=$(stat -f%z "$src")
  total_before=$((total_before + before))

  relative="${src#assets/}"
  backup_path="$BACKUP_DIR/$relative"
  mkdir -p "$(dirname "$backup_path")"
  cp "$src" "$backup_path"

  # .mov gets a new .mp4 sibling and the original .mov is removed
  if [[ "$src" == *.mov ]]; then
    dst="${src%.mov}.mp4"
    final_path="$dst"
  else
    dst="${src}.tmp.mp4"
    final_path="$src"
  fi

  if ! ffmpeg -y -nostdin -hide_banner -loglevel error \
    -i "$src" \
    -c:v libx264 -crf 24 -preset slow \
    -profile:v high -level 4.0 -pix_fmt yuv420p \
    -c:a aac -b:a 96k \
    -movflags +faststart \
    "$dst"; then
    echo "  FAILED: $src" >&2
    continue
  fi

  if [[ "$src" == *.mov ]]; then
    rm "$src"
    echo "  rename: $src -> $dst"
  else
    mv "$dst" "$src"
  fi

  after=$(stat -f%z "$final_path")
  total_after=$((total_after + after))

  before_mb=$(awk "BEGIN{printf \"%.1f\", $before/1024/1024}")
  after_mb=$(awk "BEGIN{printf \"%.1f\", $after/1024/1024}")
  printf "  %-55s %6s MB  ->  %6s MB\n" "$filename" "$before_mb" "$after_mb"

done < <(find assets -type f \( -name "*.mp4" -o -name "*.mov" \) -size +1M -print0 | sort -z)

echo "---"
total_before_mb=$(awk "BEGIN{printf \"%.1f\", $total_before/1024/1024}")
total_after_mb=$(awk "BEGIN{printf \"%.1f\", $total_after/1024/1024}")
echo "total: ${total_before_mb} MB -> ${total_after_mb} MB"
echo "originals backed up to: $BACKUP_DIR"
