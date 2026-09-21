# Forest: panel de administración en Netlify

Este paquete conserva la portada, fondo, brillos, navegación lateral, versión PC/celular y los 11 RRPP. Agrega un panel en `/admin/` para agregar, editar y eliminar contactos. Los datos se guardan en Netlify Blobs y se leen desde cualquier dispositivo; no se guardan solamente en tu navegador.

ESTADO: archivos preparados y pruebas locales aprobadas. Aún no está desplegado ni verificado en tu cuenta de Netlify. Las pruebas usan un almacenamiento simulado; la conexión real a Netlify se verifica después de publicar.

## Activación inicial desde GitHub y Netlify (recomendada)

1. Descomprimí `forest-admin-netlify.zip` en tu computadora.
2. Subí el CONTENIDO de la carpeta a un repositorio de GitHub. En la raíz deben estar `netlify.toml`, `package.json`, `package-lock.json`, `scripts-check.mjs`, y las carpetas `public`, `netlify` y `server`. También podés subir `tests` y este instructivo. No subas `node_modules` ni contraseñas. No copies solamente el HTML.
3. En el proyecto ACTUAL de Netlify, abrí Project configuration → Build & deploy → Continuous deployment → Repository y vinculá ese repositorio. Conservá el mismo proyecto para mantener tu dirección web. Si aparece otra opción o tu sitio es de subida manual, enviá una captura para continuar desde ahí.
4. Configuración: comando `npm run build`; directorio publicado `public`; funciones `netlify/functions`. El archivo `netlify.toml` ya incluye estos valores y Node 22.
5. En Project configuration → Environment variables, agregá `FOREST_ADMIN_PASSWORD`. Su valor debe ser una contraseña única de al menos 16 caracteres, idealmente generada por tu gestor de contraseñas. Usá alcance Functions si tu plan permite elegirlo. Configurala SOLO para Production. No la pegues en archivos ni en GitHub. No necesitás enviársela a ChatGPT.
6. Publicá de nuevo con Trigger deploy → Deploy site / Deploy project. Esperá el estado Published.
7. Abrí tu dirección actual con `/admin/` al final. Usuario: `admin`. Contraseña: la que guardaste en el paso 5.
8. Verificá que los 11 contactos estén presentes. Agregá uno de prueba y abrí la página en otra pestaña o dispositivo; debería aparecer. Eliminá el contacto de prueba cuando termines.

IMPORTANTE: Netlify Drop (arrastrar una carpeta con HTML a la web) no ejecuta este proceso de compilación de Functions. Para activar este panel usá la integración Git o Netlify CLI. El archivo `public/index.html` tampoco es una versión independiente: ahora necesita las Functions del proyecto.

## Alternativa para quien usa Netlify CLI

Con Node 22, en la carpeta extraída:

```sh
npm ci
npm test
npx netlify-cli login
npx netlify-cli link
```

Seleccioná el proyecto EXISTENTE. Configurá la variable secreta en la web de Netlify como se indica arriba. Luego:

```sh
npx netlify-cli deploy --build --prod
```

No crees otro proyecto salvo que quieras cambiar de dirección. No pegues la contraseña en el comando.

## Uso diario

- Entrá a `/admin/`, iniciá sesión y completá nombre, localidad y WhatsApp y/o Instagram.
- WhatsApp acepta números uruguayos con cero inicial, espacios o un número internacional con código de país.
- Instagram acepta `usuario`, `@usuario` o un enlace a instagram.com.
- Guardar publica los cambios. Las páginas nuevas consultan los datos actuales; una pestaña abierta los actualiza cada 60 segundos o al recuperar el foco.
- Editar carga los datos en el formulario. Eliminar pide confirmación.
- Cerrar sesión revoca el acceso de ese navegador. La sesión también vence a las 8 horas.
- Si guardás desde dos ventanas, el sistema rechaza cambios sobre una lista desactualizada para no pisar datos. Tocá Actualizar lista y repetí la edición.
- Para cambiar la contraseña, editá la variable en Netlify y volvé a publicar. Esto invalida las sesiones anteriores.

## Datos y límites

- Los contactos se conservan al volver a publicar dentro del mismo proyecto de Netlify.
- Se usa el almacén `forest-rrpp-v1`, clave `contacts`. Podés descargar una copia desde la sección Blobs de Netlify.
- No borres el proyecto o el almacén si querés conservar los contactos.
- Hay un máximo de 250 RRPP. El acceso al panel se limita a 15 peticiones cada 3 minutos por IP y dominio.
- Los planes y consumos dependen de tu cuenta de Netlify. Este paquete no contrata un plan ni garantiza un costo cero.
- Las vistas previas de despliegue no reciben la contraseña si la variable se limita a Production.

## Archivos

- `public/`: página y panel que ven los usuarios.
- `netlify/functions/`: acceso y API protegida.
- `server/`: validación, sesiones y contactos iniciales.
- `tests/`: pruebas de autorización, persistencia simulada, conflictos, revocación y validación.
- No hay contraseña predeterminada ni incluida en el paquete.

## Documentación oficial

- https://docs.netlify.com/build/data-and-storage/netlify-blobs/
- https://docs.netlify.com/build/functions/deploy/
- https://docs.netlify.com/build/configure-builds/environment-variables/
- https://docs.netlify.com/manage/security/secure-access-to-sites/rate-limiting/
