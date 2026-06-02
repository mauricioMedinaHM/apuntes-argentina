<div align="center">

<img src="public/sol-de-mayo.svg" width="80" alt="Sol de Mayo" />

# ApuntesArgentina

**El lugar donde el conocimiento de las universidades públicas argentinas deja de perderse.**

Buscá apuntes. Subí los tuyos. Ayudá a alguien que todavía no conocés.

[![Estado](https://img.shields.io/badge/estado-en%20desarrollo-fcbf49?style=flat-square)](https://github.com/mauricioMedinaHM/apuntes-argentina)
[![Licencia](https://img.shields.io/badge/licencia-MIT-23355C?style=flat-square)](LICENSE)
[![Open Source](https://img.shields.io/badge/open%20source-%E2%9D%A4-576F92?style=flat-square)](https://github.com/mauricioMedinaHM/apuntes-argentina)

</div>

---

## ¿Por qué existe esto?

Cada año, miles de estudiantes de universidades públicas argentinas pierden horas buscando apuntes de materias que ya fueron cursadas cientos de veces. La información existe — está en grupos de WhatsApp que se borran, en Google Drives que nadie comparte, en carpetas de ex compañeros que ya se recibieron.

ApuntesArgentina es un intento de cambiar eso: **un solo lugar, público, sin login, organizado por universidad y materia, mantenido por la propia comunidad.**

Lo que sabés hoy puede ahorrarle horas a alguien mañana.

---

## ¿Cómo podés ayudar?

Hay dos formas de contribuir, y ninguna requiere saber programar:

### 📄 Subir apuntes

Si tenés apuntes, resúmenes, guías o parciales resueltos que te ayudaron, subílos. Eso es todo. No hace falta hacer nada técnico.

→ [Ver cómo subir apuntes](#subir-apuntes)

### 💻 Contribuir como desarrollador

Si sabés programar — o querés aprender — hay tareas de todo nivel esperándote.

→ [Ver cómo contribuir al código](#contribuir-al-código)

---

## Subir apuntes

> La plataforma de vault está en desarrollo. Por ahora, podés abrir un issue o mandar un PR con tus archivos directamente.

**¿Qué se puede subir?**

- Resúmenes de clase
- Guías de ejercicios
- Parciales resueltos
- Apuntes de teórico
- Mapas conceptuales
- Cualquier material que te haya ayudado a estudiar

**¿Cómo?**

1. Abrí un [nuevo issue](https://github.com/mauricioMedinaHM/apuntes-argentina/issues/new) con el título `[Apunte] Universidad / Carrera / Materia`
2. Contanos qué material tenés
3. Te contactamos para coordinar cómo subirlo

O si querés hacerlo directo, mandá un mail a [hh.mauri2190@gmail.com](mailto:hh.mauri2190@gmail.com) con el asunto `Apunte: [Universidad] – [Materia]`.

**Formato de organización:**

```
/{Universidad}/{Carrera}/{Materia}/
    resumen_unidad1.pdf
    parcial_resuelto_2024.pdf
    guia_ejercicios.pdf
    metadata.json
```

---

## Contribuir al código

### Stack

| Parte | Tecnología |
|---|---|
| Frontend (landing) | React 19 + Vite 6 |
| Animaciones | Motion (Framer Motion) |
| Iconos | Lucide React |
| MCP Server | TypeScript + Node.js 18 |
| Storage | AWS S3 / Cloudflare R2 |
| PDF parsing | pdf-parse |

### Levantá el proyecto

```bash
# Cloná el repo
git clone https://github.com/mauricioMedinaHM/apuntes-argentina.git
cd apuntes-argentina

# Instalá dependencias
npm install

# Arrancá el servidor de desarrollo
npm run dev
# → http://localhost:5173
```

Eso es todo. No hace falta ninguna variable de entorno para ver el frontend corriendo.

### Estructura del proyecto

```
apuntes-argentina/
├── src/
│   ├── App.jsx              # Componente principal + todas las secciones
│   ├── VaultAnimation.jsx   # Animación del vault (drag → organización)
│   ├── MockApuntes.jsx      # Mockup interactivo de la plataforma
│   ├── SplashScreen.jsx     # Pantalla de carga con Sol de Mayo
│   ├── App.css              # Todos los estilos
│   └── index.css            # Variables globales + reset
├── public/
│   ├── logos/               # Logos de universidades
│   └── sol-de-mayo.svg      # Sol de Mayo (bandera argentina)
└── index.html
```

### ¿Por dónde empiezo?

Si nunca contribuiste a un proyecto open source, este es un buen lugar para empezar. Hay tareas de todo nivel:

**Nivel entrada — sin necesidad de experiencia previa:**
- Agregar una universidad que falta en la lista
- Corregir un typo o mejorar un texto
- Agregar el logo de una universidad que no tiene
- Mejorar la accesibilidad (alt texts, aria labels)

**Nivel intermedio:**
- Mejorar el responsive en dispositivos específicos
- Agregar una nueva sección a la landing
- Mejorar las animaciones existentes
- Agregar tests

**Nivel avanzado:**
- Construir la integración real con el vault S3/R2
- Implementar el sistema de búsqueda de apuntes
- Integrar el servidor MCP con la landing
- Sistema de upload de archivos

### Flujo de contribución

```bash
# 1. Forkeá el repo desde GitHub

# 2. Cloná tu fork
git clone https://github.com/TU-USUARIO/apuntes-argentina.git

# 3. Creá una rama con un nombre descriptivo
git checkout -b feat/agregar-logo-unt
git checkout -b fix/responsive-mobile-vault
git checkout -b content/apuntes-uba-derecho

# 4. Hacé tus cambios y commitea
git add .
git commit -m "feat: agrega logo de UNT"

# 5. Pusheá y abrí un Pull Request
git push origin feat/agregar-logo-unt
```

Abrí el PR aunque esté incompleto — podemos colaborar desde ahí.

### Agregar una universidad

En `src/App.jsx`, buscá el array `UNIVERSITIES` y agregá la tuya:

```js
{ 
  id: 'unl',
  name: 'UNL',
  full: 'Universidad Nacional del Litoral',
  color: '#005C9E',
  logo: '/logos/unl.png',  // o null si no tenés el logo
},
```

Si tenés el logo, poné el archivo en `public/logos/` en formato PNG o SVG con fondo transparente.

### Issues abiertos

Revisá los [issues abiertos](https://github.com/mauricioMedinaHM/apuntes-argentina/issues) — cualquier cosa marcada con `good first issue` es un buen punto de entrada.

Si encontrás un bug o tenés una idea, abrí un issue antes de ponerte a codear. Así coordinamos y evitamos trabajo duplicado.

---

## Universidades actualmente en la plataforma

| Universidad | Sigla | Estado |
|---|---|---|
| Universidad de Buenos Aires | UBA | ✓ En la lista |
| Universidad Nacional de Córdoba | UNC | ✓ En la lista |
| Universidad Nacional de La Plata | UNLP | ✓ En la lista |
| Universidad Tecnológica Nacional | UTN | ✓ En la lista |
| Universidad Nacional de Rosario | UNR | ✓ En la lista |
| Universidad Nacional de Cuyo | UNCu | ✓ En la lista |
| Universidad Nacional del Nordeste | UNNE | ✓ En la lista |
| Universidad Nacional de Salta | UNSA | ✓ En la lista |
| Universidad Nacional de Tucumán | UNT | ✓ En la lista |
| Universidad Nacional de Mar del Plata | UNMdP | ✓ En la lista |
| Universidad Nacional de San Juan | UNSJ | ✓ En la lista |
| Universidad Nacional de La Matanza | UNLaM | ✓ En la lista |

**¿No está la tuya?** Abrí un issue o mandá un PR — la agregamos.

---

## Roadmap

Lo que viene, en orden de prioridad:

- [ ] **Vault funcional** — integración real con S3/R2 para subir y bajar archivos
- [ ] **Buscador** — buscar por universidad, carrera, materia y contenido
- [ ] **Upload desde la web** — subir apuntes directamente desde el browser
- [ ] **MCP Server** — conectar el vault a Claude, Cursor y ChatGPT como fuente de conocimiento
- [ ] **Más universidades** — llegar a las 57 universidades nacionales
- [ ] **Dominio propio** — apuntesargentina.ar
- [ ] **App móvil** — opcional, si la comunidad lo pide

---

## Financiamiento

ApuntesArgentina no tiene fines de lucro y no tiene financiamiento todavía. El vault (almacenamiento de archivos) tiene un costo real que estamos buscando cómo cubrir — ya sea con sponsors, donaciones o un modelo freemium muy limitado que nunca afecte el acceso a los apuntes.

Si trabajás en una empresa de tecnología o educación y querés apoyar el proyecto, escribinos.

---

## Licencia

MIT — hacé lo que quieras con el código, siempre que mantengas el mismo espíritu abierto.

---

<div align="center">

Hecho por estudiantes, para estudiantes.

**[Ver el sitio](https://apuntesargentina.ar)** · **[Abrir un issue](https://github.com/mauricioMedinaHM/apuntes-argentina/issues)** · **[Seguir en Instagram](https://instagram.com/mauri.h.m)**

</div>
