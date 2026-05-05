#!/bin/bash

# Fix SigninFormComponent import path
sed -i "s|from '../../shared/services/auth\.service'|from '../../../shared/services/auth.service'|g" src/app/shared/components/auth/signin-form/signin-form.component.ts

# Fix SignupFormComponent import path
sed -i "s|from '../../shared/services/auth\.service'|from '../../../shared/services/auth.service'|g" src/app/shared/components/auth/signup-form/signup-form.component.ts

# Fix UserDropdownComponent import path
sed -i "s|from '../../shared/services/auth\.service'|from '../../../shared/services/auth.service'|g" src/app/shared/components/header/user-dropdown/user-dropdown.component.ts

# Fix EventTasksComponent import path  
sed -i "s|from '../../../shared/services/auth\.service'|from '../../../../shared/services/auth.service'|g" src/app/pages/tasks/event-tasks/event-tasks/event-tasks.component.ts

# Add implicit type annotations to signin-form
sed -i 's/next: (response) => {/next: (response: any) => {/g' src/app/shared/components/auth/signin-form/signin-form.component.ts
sed -i 's/next: (me) => {/next: (me: any) => {/g' src/app/shared/components/auth/signin-form/signin-form.component.ts
sed -i 's/error: (err) => {/error: (err: any) => {/g' src/app/shared/components/auth/signin-form/signin-form.component.ts

# Add implicit type annotations to signup-form
sed -i 's/next: (response) => {/next: (response: any) => {/g' src/app/shared/components/auth/signup-form/signup-form.component.ts
sed -i 's/error: (err) => {/error: (err: any) => {/g' src/app/shared/components/auth/signup-form/signup-form.component.ts

# Add implicit type annotations to user-dropdown
sed -i 's/\.subscribe(u => this\.user = u)/\.subscribe((u: any) => this.user = u)/g' src/app/shared/components/header/user-dropdown/user-dropdown.component.ts

echo "✅ All fixes applied!"
