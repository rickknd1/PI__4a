#!/bin/bash

# For all files in src/app/shared/components/ - they need to go:
# From: src/app/shared/components/SUBDIR/...
# To: src/app/shared/services/auth.service
# That's 1-2 levels up + shared/services

# Fix signin-form: src/app/shared/components/auth/signin-form/signin-form.component.ts
# Go up 3 levels to src/app, then down to shared/services
find src/app/shared/components/auth -name "*.component.ts" | while read f; do
  sed -i "s|from '[^']*auth\.service'|from '../../../services/auth.service'|g" "$f"
done

# Fix signup-form
find src/app/shared/components/auth -name "*.component.ts" | while read f; do  
  sed -i "s|from '[^']*auth\.service'|from '../../../services/auth.service'|g" "$f"
done

# Fix user-dropdown: src/app/shared/components/header/user-dropdown/user-dropdown.component.ts  
# Go up 3 levels to src/app, then to shared/services
find src/app/shared/components/header -name "*.component.ts" | while read f; do
  sed -i "s|from '[^']*auth\.service'|from '../../../services/auth.service'|g" "$f"
done

# Verify
echo "Checking paths..."
grep "from.*auth.service" src/app/shared/components/auth/signin-form/signin-form.component.ts
grep "from.*auth.service" src/app/shared/components/header/user-dropdown/user-dropdown.component.ts
