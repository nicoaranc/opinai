# opinai — frontend

SPA con React + Vite + TypeScript. Ver [`../architecture.md`](../architecture.md) para la arquitectura completa.

```bash
npm install
npm run dev      # http://localhost:5173 (necesita el back en :3000)
npm run build    # compila a dist/
npm run lint
```

El front llama siempre a `/api` en su mismo origen: en local, Vite lo reenvía a `http://localhost:3000`, y en producción lo hará una regla *rewrite* de Render. Así la cookie de sesión funciona sin cookies de terceros.
