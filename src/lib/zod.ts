import { z } from 'zod'

// Zod's JIT compiles validators with `new Function`, which the app's CSP (rightly)
// forbids. Configure it here, before any schema is created; import `z` from this module.
z.config({ jitless: true })

export { z }
