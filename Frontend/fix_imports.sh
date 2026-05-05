#!/bin/bash
# Fix all auth.service imports by calculating correct relative paths

find src/app -type f -name "*.ts" | while IFS= read -r file; do
  # Count how many directories deep the file is
  # src/app/file.ts = 2 levels, src/app/dir/file.ts = 3 levels, etc.
  depth=$(echo "$file" | grep -o '/' | wc -l)
  
  # Calculate how many ../ we need to go back to reach src/app/shared/services/
  # src/app = 2 levels
  # src/app/X = 3 levels -> need ../../../shared
  # src/app/X/Y = 4 levels -> need ../../../../shared
  # src/app/X/Y/Z = 5 levels -> need ../../../../../shared
  
  ups=$((depth - 1))  # Go up to src/app level
  relpath=""
  for ((i=0; i<$ups; i++)); do
    relpath="${relpath}../"
  done
  relpath="${relpath}shared/services/auth.service"
  
  # Replace all variations of the import
  sed -i "s|from '[^']*shared/services/auth\.service'|from '${relpath}'|g" "$file"
  sed -i "s|from \"[^\"]*shared/services/auth\.service\"|from \"${relpath}\"|g" "$file"
done

echo "✅ All imports fixed!"
