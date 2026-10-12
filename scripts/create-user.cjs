require('./register-runtime.cjs');const {createUser}=require('../src/infrastructure/auth/session.ts');
// Input supplied explicitly through a private file or environment, never a default shared password.
const fs=require('node:fs');const data=process.env.CDC_IDENTITY_FILE?fs.readFileSync(process.env.CDC_IDENTITY_FILE,'utf8'):process.env.CDC_IDENTITY_JSON;if(!data)throw new Error('Provide CDC_IDENTITY_FILE or CDC_IDENTITY_JSON');const principal=createUser(JSON.parse(data));console.log(JSON.stringify({userId:principal.userId,role:principal.role,domainGrants:principal.domainGrants}));
