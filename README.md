<div align="center">

<img src="public/sol-de-mayo.svg" width="80" alt="Sol de Mayo" />

# ApuntesArgentina

**El lugar donde el conocimiento de las universidades públicas argentinas deja de perderse.**

[![Estado](https://img.shields.io/badge/estado-en%20desarrollo-fcbf49?style=flat-square)](https://github.com/mauricioMedinaHM/apuntes-argentina)
[![Licencia](https://img.shields.io/badge/licencia-MIT-23355C?style=flat-square)](LICENSE)
[![Open Source](https://img.shields.io/badge/open%20source-%E2%9D%A4-576F92?style=flat-square)](https://github.com/mauricioMedinaHM/apuntes-argentina)

</div>

---

## El problema que queremos resolver

Cada año, miles de estudiantes pierden horas buscando apuntes de materias que ya fueron cursadas cientos de veces. La información existe — está en grupos de WhatsApp que se borran, en Google Drives privados, en carpetas de ex compañeros que ya se recibieron.

ApuntesArgentina quiere ser el lugar donde eso cambie: un solo sitio, público, sin login, donde cualquier estudiante pueda encontrar y subir apuntes directamente, sin pedirle permiso a nadie.

---

## Por qué todavía no está lista

La plataforma necesita un **vault** — un sistema de almacenamiento en la nube donde vivan todos los archivos. Eso tiene un costo real. Hoy ese costo no está cubierto, y sin eso no hay lugar donde guardar los apuntes.

**Una vez que el financiamiento esté resuelto:**
- Cualquier persona sube sus apuntes directamente desde el sitio
- Nadie actúa como intermediario
- El sistema los organiza solo por universidad, carrera y materia
- Cualquier persona los descarga sin registrarse

---

## ¿Cómo podés ayudar a que esto exista?

### 💰 Financiar el vault

Es la prioridad número uno. Sin esto, nada de lo demás importa.

Si trabajás en una empresa de tecnología, educación o tenés posibilidad de apoyar el proyecto económicamente, escribí a [hh.mauri2190@gmail.com](mailto:hh.mauri2190@gmail.com) con el asunto `Financiamiento ApuntesArgentina`.

No hace falta que sea mucho. Con cubrir el costo mensual de almacenamiento la plataforma puede abrirse para todos.

### 💻 Contribuir al código

Si sabés programar — o querés aprender — el proyecto está abierto. Hay tareas de todo nivel.

Lo único para lo que necesitás hablar con nosotros es para sumarte como colaborador del repositorio. Para todo lo demás podés abrir un issue o un PR directamente.

→ [Ver cómo contribuir](#contribuir-al-código)

---

## Contribuir al código

### Levantá el proyecto

```bash
git clone https://github.com/mauricioMedinaHM/apuntes-argentina.git
cd apuntes-argentina
npm install
npm run dev
# → http://localhost:5173
```

No hace falta ninguna variable de entorno para ver el frontend.

### Stack

| Parte | Tecnología |
|---|---|
| Frontend | React 19 + Vite 8 (Node 22) |
| Animaciones | Motion (Framer Motion) |
| Iconos | Lucide React |
| MCP Server (pendiente) | TypeScript + Node.js |
| Storage (pendiente) | AWS S3 / Cloudflare R2 |

### Estructura

```
src/
├── App.jsx              # Componente principal
├── VaultAnimation.jsx   # Animación del vault
├── MockApuntes.jsx      # Mockup de la plataforma
├── SplashScreen.jsx     # Pantalla de carga
├── App.css              # Estilos
└── index.css            # Variables globales
public/
├── logos/               # Logos de universidades
└── sol-de-mayo.svg
```

### Tareas disponibles

**Sin experiencia previa:**
- Agregar una universidad que falta
- Mejorar textos o corregir typos
- Agregar el logo de una universidad que no tiene

**Nivel intermedio:**
- Mejorar el responsive en dispositivos específicos
- Mejorar animaciones existentes

**Nivel avanzado:**
- Integración real con el vault (S3/R2) cuando el financiamiento esté resuelto
- Sistema de búsqueda de apuntes
- Sistema de upload desde el browser

### Cómo contribuir

```bash
# Forkeá el repo, cloná tu fork
git checkout -b feat/nombre-descriptivo

# Hacé tus cambios
git commit -m "feat: descripción del cambio"
git push origin feat/nombre-descriptivo

# Abrí un Pull Request
```

Para sumarte como colaborador del repositorio con acceso directo, escribí a [hh.mauri2190@gmail.com](mailto:hh.mauri2190@gmail.com) con el asunto `Quiero contribuir a ApuntesArgentina`.

### Agregar una universidad

En `src/App.jsx`, buscá el array `UNIVERSITIES`:

```js
{
  id: 'unl',
  name: 'UNL',
  full: 'Universidad Nacional del Litoral',
  color: '#005C9E',
  logo: '/logos/unl.png', // null si no tenés el logo
},
```

El logo va en `public/logos/` en PNG o SVG con fondo transparente.

---

## Roadmap

- [ ] **Financiamiento del vault** ← estamos acá
- [ ] Vault funcional con S3/R2
- [ ] Upload directo desde el browser
- [ ] Buscador por universidad, carrera y materia
- [ ] MCP Server conectado al vault
- [ ] Dominio propio — apuntesargentina.ar
- [ ] Las 57 universidades nacionales

---

## Licencia

MIT.

---

<div align="center">

Hecho por estudiantes, para estudiantes.

**[Ver el sitio](https://apuntesargentina.ar)** · **[Abrir un issue](https://github.com/mauricioMedinaHM/apuntes-argentina/issues)** · **[Instagram](https://instagram.com/mauri.h.m)**

</div>
