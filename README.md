# 🎪 FerIA v3 · Ferias + IA + Web3

> Sistema integral para emprendedores, organizadores y administración municipal

🚀 **Características principales:**
- ✨ Perfil de emprendedor con imágenes y productos
- 📊 Inscripción a ferias con PostgreSQL
- 🤖 IA con Gemini
- 🔗 Trazabilidad blockchain con Arkiv
- 💰 Pagos con Stellar testnet
- 🐳 Containerizado con Docker

---

## 🔄 Qué se modificó

| Característica | Descripción |
|---|---|
| **Perfil de emprendedor** | Nombre comercial, rubro, descripción, imagen principal del stand + 3 imágenes de productos |
| **Mis ferias / Inscripciones** | Guardado en PostgreSQL, refresco automático, sin duplicados (emprendedor + feria) |
| **IA** | Migración de Claude a Gemini con @google/genai |
| **Base de datos** | Prisma ORM + PostgreSQL, migraciones y seeder |
| **Arkiv Braga** | Publicación on-chain de entidades verificables |
| **Stellar** | PaymentIntent por inscripción con memo único |
| **Docker** | Compose file + Dockerfiles + Nginx proxy |

---

## 🏗️ Arquitectura
feria-arkiv/
├── backend/
│   ├── prisma/              # Esquema y migraciones de DB
│   ├── src/
│   │   ├── routes/          # Endpoints Fastify
│   │   ├── services/        # Lógica de negocio (Arkiv, Stellar, Gemini)
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
STELLAR_PUBLIC_KEY=wallet_destino_stellar_testnet
Para publicar en Arkiv Braga:

ARKIV_PRIVATE_KEY=0xTU_CLAVE_PRIVADA_AQUI
ARKIV_RPC_URL=https://braga.hoodi.arkiv.network/rpc
Ejecución con Docker
cp backend/.env.example backend/.env
# editar backend/.env

docker compose up --build
Servicios:

Frontend: http://localhost:8080
Backend: http://localhost:4100
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

Uso de Stellar en el proyecto
El caso de uso elegido es Pagos y remesas / micropagos programáticos. Cuando un emprendedor se inscribe, el backend crea un PaymentIntent con:

red: testnet/public según .env
destino: STELLAR_PUBLIC_KEY
asset: XLM por defecto
monto: costo del stand
memo único: FERIA-...
<img width="1600" height="761" alt="WhatsApp Image 2026-05-30 at 02 01 06" src="https://github.com/user-attachments/assets/a12bea62-1c75-473e-841c-a5d7e25724ac" />
La firma del pago queda del lado de la wallet del usuario. El backend conserva el memo para conciliación y permite guardar el hash de transacción con /api/payments/:paymentId/confirm.

Uso de Arkiv en el proyecto
El caso de uso elegido es Trazabilidad y credenciales verificables. Se publican entidades para:

usuarios
perfiles de emprendedores
ferias
inscripciones
Durante desarrollo, si no se configura ARKIV_PRIVATE_KEY, el sistema sigue funcionando con PostgreSQL y marca Arkiv como omitido. Para hackathon/demo con Braga, cargar una wallet con GLM del faucet.
