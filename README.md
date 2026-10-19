# 🎪 FerIA v3 · Ferias + IA

> Sistema integral para emprendedores, organizadores y el gobierno provincial

🚀 **Características principales:**
- ✨ Perfil de emprendedor con imágenes y productos
- 📊 Inscripción a ferias con PostgreSQL
- 🤖 IA con Gemini
- 🐳 Containerizado con Docker

---

## 🔄 Qué se modificó

| Característica | Descripción |
|---|---|
| **Perfil de emprendedor** | Nombre comercial, rubro, descripción, imagen principal del stand + 3 imágenes de productos |
| **Mis ferias / Inscripciones** | Guardado en PostgreSQL, refresco automático, sin duplicados (emprendedor + feria) |
| **IA** | Migración de Claude a Gemini con @google/genai |
| **Base de datos** | Prisma ORM + PostgreSQL, migraciones y seeder |
| **Docker** | Compose file + Dockerfiles + Nginx proxy |

---

## 🏗️ Arquitectura
feria-arkiv/
├── backend/
│   ├── prisma/              # Esquema y migraciones de DB
│   ├── src/
│   │   ├── routes/          # Endpoints Fastify
│   │   ├── services/        # Lógica de negocio (Gemini)
│   │   └── server.ts        # Punto de entrada del backend
│   └── uploads/             # Almacenamiento de imágenes
├── src/                     # Frontend (Vite + React + TS)
│   ├── components/
│   ├── pages/
│   └── services/
├── nginx.conf               # Configuración de Nginx para producción
├── Dockerfile.frontend
└── docker-compose.yml
Variables de entorno
Copiar el ejemplo:

cd backend
cp .env.example .env
Completar como mínimo:

DATABASE_URL=postgresql://feria:feria123@localhost:5432/feria_db?schema=public
GEMINI_API_KEY=tu_api_key_de_gemini
Ejecución con Docker
cp backend/.env.example backend/.env
# editar backend/.env

docker compose up --build
Servicios:

Frontend: http://localhost:8080
Backend: http://localhost:3000
PostgreSQL: localhost:5432
El contenedor backend ejecuta automáticamente:

npx prisma migrate deploy
npx prisma db seed
npm start
Ejecución local sin Docker
1. PostgreSQL
Crear una base feria_db o levantar solo PostgreSQL:

docker compose up postgres
2. Backend
cd backend
npm install
npx prisma generate
npx prisma migrate deploy
npm run seed
npm run dev
3. Frontend
# En el directorio raíz
npm install
npm run dev
Frontend local: http://localhost:5173.

4. Ambos servicios (local)
npm run dev:all
Usuarios demo del seeder
Admin: local-admin-demo
Emprendedor: local-emprendedor-demo
En el login se usa la entityKey como clave de acceso.

## Datos
Las ferias, aprobaciones, inscripciones y certificados se guardan en la tabla `feria_entities` de PostgreSQL.
Para cargar datos de demostración (ferias aprobadas, emprendedores inscriptos y certificados):

```
cd backend
npm run seed:demo
```

El script se puede volver a ejecutar: reemplaza solo los datos que él mismo creó.
