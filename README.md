# Serya WMS — proyecto web

## 1. Probarlo en tu computadora (opcional pero recomendado)

Necesitas tener [Node.js](https://nodejs.org) instalado (descarga la versión "LTS").

```bash
npm install
npm run dev
```

Abre el link que aparece (normalmente `http://localhost:5173`) — deberías ver el WMS
funcionando con los datos reales de tu Supabase.

## 2. Subir el código a GitHub

1. Ve a **github.com** → botón verde "New" (crear repositorio)
2. Nómbralo `serya-wms` → "Create repository"
3. En tu computadora, dentro de esta carpeta:

```bash
git init
git add .
git commit -m "Primera versión del WMS"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/serya-wms.git
git push -u origin main
```

(Reemplaza `TU-USUARIO` por tu usuario de GitHub — te lo muestra la propia página
después de crear el repositorio, con estos comandos ya armados para copiar y pegar.)

## 3. Desplegar en Vercel

1. Ve a **vercel.com** → "Add New" → "Project"
2. Selecciona el repositorio `serya-wms` que acabas de subir
3. Antes de darle "Deploy", abre "Environment Variables" y agrega:
   - `VITE_SUPABASE_URL` = `https://xvbejwawovrrmecjskyk.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = (la key larga que empieza con `eyJ...`)
4. Clic en "Deploy" — espera 1-2 minutos
5. Vercel te da una URL como `serya-wms.vercel.app` — esa es tu página, ya en internet

## Actualizar la página después de un cambio

Cada vez que quieras subir un cambio nuevo (que yo te prepare o que tú edites):

```bash
git add .
git commit -m "Descripción del cambio"
git push
```

Vercel detecta el push automáticamente y actualiza la página sola en un par de minutos.

## Nota de seguridad

El archivo `.env` tiene tus credenciales de Supabase y **no se sube a GitHub** (está en
`.gitignore` a propósito). Por eso hay que agregar esas mismas dos variables manualmente
en Vercel en el paso 3 — si no, la página no sabrá a qué base de datos conectarse.
