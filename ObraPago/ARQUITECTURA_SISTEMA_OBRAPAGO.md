# Documento de Arquitectura de Software: Sistema ObraPago
**Control de Jornales, Asistencia, Obras y Planillas para el Sector Construcción**

---

## 1. Ficha Técnica del Proyecto

| Parámetro | Detalle Técnico |
| :--- | :--- |
| **Nombre del Sistema** | **ObraPago** — Sistema Integral de Control de Jornales y Planillas |
| **Institución / Contexto** | Universidad Peruana Unión (UPeU) / Curso LP2 |
| **Versión del Sistema** | v1.0.0-RELEASE (Producción Contenedorizada) |
| **Arquitectura de Software** | Arquitectura en Capas desacoplada basada en Contenedores Microservicios/Servicios |
| **Lenguaje Backend** | Java 21 LTS |
| **Framework Backend** | Spring Boot 3.5.16 (Spring Data JPA, Spring Web, Spring Validation) |
| **Framework Frontend** | Angular 22.2 (Componentes Standalone, Vite/Application Builder) |
| **Gestor de Identidad (IdP)** | Red Hat Keycloak 26.1 (OAuth 2.0 / OpenID Connect / RBAC) |
| **Base de Datos** | Oracle Database 23c Free (`FREEPDB1`) |
| **Servidor Web Frontend** | Nginx Alpine (Reverse Proxy & Static Web Server) |
| **Orquestación de Infraestructura** | Docker Compose v2 (Red Bridge dedicada `obrapago-net`) |
| **Documentación de APIs** | SpringDoc OpenAPI 2.8.17 / Swagger UI |

---

## 2. Resumen Ejecutivo y Alcance

El sistema **ObraPago** es una solución empresarial de software diseñada específicamente para resolver la alta complejidad operativa de la gestión de mano de obra en el sector de la construcción civil. Entre sus objetivos primordiales se encuentran:

1. **Gestión de Personal Obrero**: Registro maestro de trabajadores con estandarización de nombres en formato `Apellidos, Nombres` y ordenamiento alfabético estricto de la A a la Z.
2. **Asignación Multiobra (N:M)**: Posibilidad de vincular múltiples obreros a distintas obras simultáneamente y gestionar sus cuadrillas.
3. **Control Riguroso de Asistencia**: Registro diario de jornadas laborales (asistencias, faltas, tardanzas y permisos) con cálculo de horas efectivas.
4. **Vales y Adelantos Semanales**: Emisión y control de adelantos de efectivo con amortización y descuento automático en el corte de nómina.
5. **Cálculo y Liquidación de Planillas**: Automatización del cálculo de jornales devengados, deducción de adelantos otorgados y emisión de boletas/detalles de pago neto.
6. **Seguridad Robusta con RBAC**: Control de acceso granular basado en 4 roles definidos en Keycloak (`ADMIN`, `SUPERVISOR`, `PLANILLERO`, `OBRERO`), garantizando que cada participante opere exclusivamente dentro de los límites de sus competencias.

---

## 3. Arquitectura Global del Sistema

El ecosistema se implementa bajo un enfoque de **servicios desacoplados en contenedores Docker**, comunicados mediante una red interna privada virtual (`obrapago-net`) y exponiendo puertos seguros hacia el host anfitrión.

```mermaid
graph TB
    subgraph UsuarioFinal["Clientes y Dispositivos"]
        Nav["💻 Navegador Web / Dispositivo Móvil"]
    end

    subgraph HostDocker["Entorno Docker (Red: obrapago-net)"]
        subgraph FrontEndTier["Capa de Presentación"]
            NGINX["Servidor Nginx (obrapago-frontend)\nPuerto: 4200 (Interno: 80)\nAngular 22 SPA"]
        end

        subgraph SecTier["Capa de Seguridad e Identidad"]
            KC["Servidor Keycloak 26.1 (obrapago-keycloak)\nPuerto: 8081 (Interno: 8080)\nRealm: obrapago-realm"]
        end

        subgraph BackEndTier["Capa de Negocio y Lógica"]
            BOOT["Backend Spring Boot 3.5 (obrapago-backend)\nPuerto: 8080 (Interno: 8080)\nJava 21 LTS REST API"]
        end

        subgraph DataTier["Capa de Persistencia"]
            ORA[("Oracle Database 23c Free (obrapago-oracle)\nPuerto: 1521\nSID/PDB: FREEPDB1\nEsquema: OBRAPAGO")]
        end
    end

    Nav -->|"HTTP / REST (Puerto 4200)"| NGINX
    Nav -->|"Autenticación SSO / OpenID (Puerto 8081)"| KC
    NGINX -->|"Peticiones API /api/v1/*"| BOOT
    BOOT -->|"Validación JWT / Token Introspection"| KC
    BOOT -->|"JDBC / HikariCP Pool (Puerto 1521)"| ORA
```

### Detalle de los 4 Contenedores Orquestados

1. **`obrapago-frontend` (Puerto 4200)**:
   - Contenedor ligero `nginx:alpine` que sirve los archivos estáticos de la aplicación Angular compilada en producción.
   - Configuración de cabeceras `Cache-Control: no-store, no-cache, must-revalidate` para garantizar actualización inmediata de la interfaz ante despliegues continuos.
2. **`obrapago-backend` (Puerto 8080)**:
   - Contenedor basado en Eclipse Temurin Java 21 ejecutando el ejecutable `app.jar` de Spring Boot.
   - Aloja la lógica de negocio, validaciones transaccionales, mapeo JPA y controladores REST.
   - Incluye una consola visual interactiva en la raíz `/` con enlaces directos a la documentación Swagger UI y al frontend.
3. **`obrapago-keycloak` (Puerto 8081)**:
   - Servidor Keycloak 26.1 en modo standalone con importación automática de reino (`realm-export.json`).
   - Administra los usuarios (`admin`, `supervisor`, `planillero`, `obrero`), las contraseñas con hash, los roles y la emisión de tokens JWT.
4. **`obrapago-oracle` (Puerto 1521)**:
   - Servidor Oracle 23c Free Slim con base de datos conectable `FREEPDB1`.
   - Almacena de manera persistente las tablas del sistema mediante un volumen Docker (`oracle-data`).

---

## 4. Capa Frontend (Angular 22 Client)

El cliente web ha sido construido bajo los estándares más modernos del ecosistema Angular:

```mermaid
graph LR
    subgraph AngularApp["Arquitectura Modular Frontend (Angular 22)"]
        Router["App Router (app.routes.ts)"]
        AuthG["AuthGuard (Control de Rutas)"]
        KCService["KeycloakService (Sesión y Roles)"]
        HTTPInter["AuthInterceptor (Inyección Bearer JWT)"]
        APIService["ApiService (Consumo HTTP HttpClient)"]

        subgraph Vistas["Componentes Standalone"]
            C_Login["Login"]
            C_Obreros["Obreros"]
            C_Obras["Obras N:M"]
            C_Asist["Asistencias"]
            C_Pagos["Planillas / Pagos"]
            C_Adel["Adelantos"]
            C_Contr["Contratos"]
            C_Cons["Consulta Obrero"]
            C_User["Usuarios (Admin)"]
            C_Acc["Accesos / Auditoría"]
        end
    end

    Router --> AuthG
    AuthG --> KCService
    Vistas --> APIService
    APIService --> HTTPInter
    HTTPInter -->|"Authorization: Bearer <Token>"| BackendAPI["Spring Boot API"]
```

### Características Técnicas del Frontend
- **Arquitectura Standalone**: No utiliza módulos antiguos `NgModule`, lo que reduce el bundle size a solo 512 KB y optimiza el árbol de dependencias con tree-shaking.
- **Intercepción de Seguridad**: Cada petición HTTP dirigida hacia `/api/v1/*` es interceptada por `auth.interceptor.ts` agregando el encabezado `Authorization: Bearer <token>`.
- **Selector Rápido de Rol en Tiempo Real**: En la barra de navegación superior se integró un conmutador de cuentas demo que permite a evaluadores y docentes verificar los límites de los 4 perfiles en vivo sin salir de la pantalla.
- **Estandarización de Datos**: Listados con avatares dinámicos basados en iniciales, badges coloreados por oficio (`OPERARIO`, `OFICIAL`, `PEON`, `MAESTRO`) y ordenamiento alfabético garantizado mediante `localeCompare` en español.

---

## 5. Capa Backend (Spring Boot 3.5 REST API)

El backend implementa una **Arquitectura en Capas Canónica** que garantiza separación de responsabilidades, alta cohesión y bajo acoplamiento:

```mermaid
graph TD
    Client["Petición HTTP Cliente"] -->|"JSON / DTO"| Controller["Controladores REST (@RestController)\npe.edu.upeu.obrapago.*.controller"]
    Controller -->|"Validación @Valid"| Service["Servicios de Negocio (@Service / @Transactional)\npe.edu.upeu.obrapago.*.service"]
    Service -->|"Entidades de Dominio"| Repo["Repositorios JPA (@Repository)\nSpring Data JPA JpaRepository"]
    Repo -->|"Hibernate ORM / SQL"| DB[("Oracle 23c Free DB")]

    Service -->|"Transformación Mappers"| DTO["DTOs (Request / Response Records)"]
    Controller -->|"HTTP 200/201/400/404"| Response["Respuesta JSON Estandarizada"]

    subgraph Transversal["Aspectos Transversales"]
        GEH["GlobalExceptionHandler (@RestControllerAdvice)"]
        CORS["Configuración CORS (Allowed Origins)"]
        OpenAPI["SpringDoc OpenAPI (Swagger 3.0)"]
    end
```

### Componentes Clave del Backend
1. **Controladores REST**: Responsables de exponer las URLs bajo el prefijo `/api/v1/`, validar los datos con Jakarta Validation (`@NotNull`, `@Size`, `@Min`) y retornar códigos de estado HTTP semánticos (`200 OK`, `201 Created`, `204 No Content`).
2. **Servicios Transaccionales**: Contienen las reglas de negocio críticas, como el cálculo de retenciones, el control de vigencia de contratos, la asignación de obreros a cuadrillas y la liquidación neta de planillas.
3. **Repositorios JPA**: Utilizan la abstracción de Spring Data JPA con consultas automáticas por método y consultas nativas optimizadas para Oracle.
4. **Manejo Centralizado de Excepciones**: `GlobalExceptionHandler.java` intercepta excepciones de negocio (`BusinessException`), recursos no encontrados (`ResourceNotFoundException`) y errores de validación, retornando un objeto `ApiError` estructurado.

---

## 6. Seguridad e Identidad: Keycloak & Matriz RBAC

La autenticación y autorización se rigen bajo el estándar industrial **Role-Based Access Control (RBAC)** administrado centralizadamente por Red Hat Keycloak.

```mermaid
sequenceDiagram
    autonumber
    actor User as Usuario (Navegador)
    participant Front as Frontend (Angular)
    participant KC as Keycloak (Puerto 8081)
    participant Back as Backend (Puerto 8080)
    participant DB as Oracle 23c

    User->>Front: Ingresa credenciales (o selecciona Rol en Demo)
    Front->>KC: Solicitud de Token OIDC (Password Grant / PKCE)
    KC-->>Front: Retorna Access Token JWT (Roles: ADMIN, SUPERVISOR, etc.)
    Front->>Front: Almacena sesión y adapta UI según roles
    Front->>Back: GET /api/v1/obreros (Header: Bearer JWT)
    Back->>Back: Valida firma, vigencia y permisos del JWT
    Back->>DB: Ejecuta SELECT filtrado y ordenado A-Z
    DB-->>Back: Retorna registros
    Back-->>Front: Retorna JSON 200 OK
    Front-->>User: Muestra tabla protegida según privilegios
```

### Matriz de Privilegios por Rol

| Módulo del Sistema | `ADMIN` | `SUPERVISOR` | `PLANILLERO` | `OBRERO (CONSULTA)` |
| :--- | :---: | :---: | :---: | :---: |
| **Ficha Obrero: Ver / Listar** |  Permitido |  Permitido |  Permitido |  **Solo Lectura** |
| **Ficha Obrero: Crear / Editar / Borrar** |  **Control Total** | ❌ Bloqueado | ❌ Bloqueado | ❌ Bloqueado |
| **Obras: Crear y Configurar** |  **Control Total** | ❌ Bloqueado | ❌ Bloqueado | ❌ Bloqueado |
| **Obras: Asignar Cuadrilla (N:M)** |  Permitido |  **Permitido** | ❌ Bloqueado | ❌ Bloqueado |
| **Contratos: Crear y Modificar** |  **Control Total** | ❌ Bloqueado | ❌ Bloqueado | ❌ Bloqueado |
| **Asistencias: Marcar y Guardar** |  Permitido |  **Permitido** | ❌ Bloqueado | ❌ Bloqueado |
| **Adelantos: Emitir y Anular** |  Permitido | ❌ Bloqueado |  **Permitido** | ❌ Bloqueado |
| **Planillas: Generar y Pagar** |  Permitido | ❌ Bloqueado |  **Permitido** | ❌ Bloqueado |
| **Consulta Individual Obrero** |  Permitido |  Permitido |  Permitido |  **Permitido** |
| **Gestión de Usuarios y Accesos** |  **Exclusivo Admin** | ❌ Oculto | ❌ Oculto | ❌ Oculto |

---

## 7. Modelo de Datos y Persistencia (Oracle 23c)

El modelo relacional fue diseñado para preservar la integridad referencial y soportar el histórico de contratos, asistencias y pagos en obras civiles.

```mermaid
erDiagram
    OBREROS ||--o{ OBRA_OBREROS : "participa en"
    OBRAS ||--o{ OBRA_OBREROS : "tiene asignados"
    OBREROS ||--o{ CONTRATOS : "suscribe"
    OBREROS ||--o{ ASISTENCIAS : "registra"
    OBREROS ||--o{ ADELANTOS : "solicita"
    OBREROS ||--o{ DETALLES_PAGO : "percibe"
    PAGOS ||--|{ DETALLES_PAGO : "contiene"
    USUARIOS ||--o{ ACCESOS : "genera"

    OBREROS {
        NUMBER id PK
        VARCHAR2 dni UK
        VARCHAR2 nombres
        VARCHAR2 apellidos
        VARCHAR2 oficio
        NUMBER tarifa_jornal
        VARCHAR2 celular
        NUMBER activo
        VARCHAR2 foto_url
    }

    OBRAS {
        NUMBER id PK
        VARCHAR2 nombre
        VARCHAR2 ubicacion
        DATE fecha_inicio
        DATE fecha_fin
        VARCHAR2 estado
        NUMBER presupuesto
    }

    OBRA_OBREROS {
        NUMBER obra_id PK,FK
        NUMBER obrero_id PK,FK
    }

    CONTRATOS {
        NUMBER id PK
        NUMBER obrero_id FK
        VARCHAR2 codigo_contrato UK
        VARCHAR2 tipo_contrato
        DATE fecha_inicio
        DATE fecha_fin
        NUMBER tarifa_pactada
        VARCHAR2 puesto
        VARCHAR2 estado
    }

    ASISTENCIAS {
        NUMBER id PK
        NUMBER obrero_id FK
        DATE fecha
        VARCHAR2 estado_asistencia
        NUMBER horas_trabajadas
        VARCHAR2 observaciones
    }

    ADELANTOS {
        NUMBER id PK
        NUMBER obrero_id FK
        NUMBER monto
        DATE fecha
        VARCHAR2 motivo
        VARCHAR2 estado
    }

    PAGOS {
        NUMBER id PK
        VARCHAR2 periodo UK
        DATE fecha_inicio
        DATE fecha_fin
        DATE fecha_pago
        VARCHAR2 estado
        NUMBER total_bruto
        NUMBER total_descuentos
        NUMBER total_neto
    }

    DETALLES_PAGO {
        NUMBER id PK
        NUMBER pago_id FK
        NUMBER obrero_id FK
        NUMBER dias_laborados
        NUMBER jornal_diario
        NUMBER total_bruto
        NUMBER total_adelantos
        NUMBER total_neto
    }

    USUARIOS {
        NUMBER id PK
        VARCHAR2 username UK
        VARCHAR2 email UK
        VARCHAR2 nombre_completo
        VARCHAR2 rol
        NUMBER activo
    }

    ACCESOS {
        NUMBER id PK
        NUMBER usuario_id FK
        VARCHAR2 modulo
        VARCHAR2 accion
        TIMESTAMP fecha_hora
        VARCHAR2 ip_origen
    }
```

---

## 8. Catálogo de Módulos Funcionales

### Módulo 1: Gestión Maestra de Obreros
- **Funcionalidad**: Alta, baja lógica, consulta y modificación de datos personales del trabajador.
- **Estandarización**: Nombres formateados estrictamente como `Apellidos, Nombres` con ordenamiento alfabético de la A a la Z en todas las vistas y reportes.
- **Integración Reniec**: Capacidad de búsqueda automatizada por número de DNI para agilizar el llenado de apellidos y nombres.

### Módulo 2: Obras y Asignación Masiva (Relación N:M)
- **Funcionalidad**: Creación y monitoreo de obras de construcción con asignación dinámica de cuadrillas de obreros.
- **Operación**: Permite agregar o remover obreros de una obra mediante switches interactivos con guardado en lote.

### Módulo 3: Contratos y Régimen Laboral
- **Funcionalidad**: Emisión de contratos temporales o indeterminados con tarifa jornal pactada, fechas de inicio y fin, y control de vencimiento.

### Módulo 4: Jornadas y Control de Asistencia
- **Funcionalidad**: Registro masivo de asistencia diaria por fecha.
- **Estados**: `ASISTIO`, `FALTA`, `TARDANZA`, `PERMISO`, con asignación de horas trabajadas para el cálculo de nómina.

### Módulo 5: Vales y Adelantos de Dinero
- **Funcionalidad**: Registro de anticipos semanales entregados a los trabajadores con motivo y fecha.
- **Liquidación Automática**: Los vales en estado `PENDIENTE` se descuentan de forma transparente al momento de liquidar la planilla quincenal o mensual.

### Módulo 6: Planilla Mensual y Liquidación de Pagos
- **Funcionalidad**: Generación automática de planillas basada en días trabajados registrados en asistencia multiplicados por la tarifa del obrero, restando los adelantos activos.
- **Trazabilidad**: Estados `GENERADA`, `PAGADA` y `ANULADA`.

### Módulo 7: Consulta Individualizada del Obrero
- **Funcionalidad**: Portal de auto-consulta donde cualquier trabajador puede ingresar su DNI y revisar sus contratos vigentes, días asistidos, vales descontados y pagos netos recibidos.

### Módulo 8: Seguridad, Usuarios y Auditoría
- **Funcionalidad**: Monitoreo de actividad del sistema con registro de cada acceso, módulo visitado, dirección IP y fecha/hora.

---

## 9. Endpoints Principales de la API REST

| Método | Endpoint | Descripción | Acceso Permitido |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | Pantalla visual informativa y estado del servidor backend | Público |
| `GET` | `/api/v1/obreros` | Lista todos los obreros ordenados alfabéticamente (A-Z) | Todos los roles |
| `POST` | `/api/v1/obreros` | Registra un nuevo obrero | `ADMIN` |
| `PUT` | `/api/v1/obreros/{id}` | Modifica datos del obrero | `ADMIN` |
| `DELETE` | `/api/v1/obreros/{id}` | Desactiva a un obrero (baja lógica) | `ADMIN` |
| `GET` | `/api/v1/obras` | Lista obras con estado y presupuesto | Todos los roles |
| `POST` | `/api/v1/obras/{id}/cuadrilla`| Asigna cuadrilla de obreros masivamente | `ADMIN`, `SUPERVISOR` |
| `GET` | `/api/v1/asistencias/fecha` | Consulta asistencia de una fecha | Todos los roles |
| `POST` | `/api/v1/asistencias/guardar`| Guarda el parte diario de asistencia | `ADMIN`, `SUPERVISOR` |
| `GET` | `/api/v1/adelantos` | Lista adelantos emitidos | Todos los roles |
| `POST` | `/api/v1/adelantos` | Registra un nuevo adelanto de dinero | `ADMIN`, `PLANILLERO` |
| `POST` | `/api/v1/pagos/calcular` | Calcula la planilla para un periodo | `ADMIN`, `PLANILLERO` |
| `POST` | `/api/v1/pagos/{id}/pagar` | Marca la planilla como pagada | `ADMIN`, `PLANILLERO` |
| `GET` | `/api/v1/consultas/obrero/{dni}`| Consulta consolidada para obrero | Todos los roles |
| `GET` | `/api/v1/accesos` | Reporte de auditoría y accesos al sistema | `ADMIN` |

---

## 10. Guía de Ejecución y Despliegue con Docker

El proyecto está 100% orquestado mediante Docker Compose.

### Requisitos Previos
- Docker Desktop instalado y en ejecución en Windows/Linux/Mac.
- Al menos 4 GB de memoria RAM libre para los contenedores (Oracle + Keycloak + Spring Boot + Nginx).

### Comandos de Despliegue

```bash
# 1. Clonar o ubicarse en la raíz del proyecto
cd d:\lp2g2

# 2. Levantar la totalidad del ecosistema en segundo plano
docker compose up -d

# 3. Verificar que los 4 contenedores estén en estado 'Up' o 'Healthy'
docker ps

# 4. URLs de Acceso Inmediato
# - Sistema Web (Frontend):        http://localhost:4200
# - Backend API & Swagger UI:      http://localhost:8080/swagger-ui.html
# - Consola Central Keycloak:      http://localhost:8081
# - Conexión Oracle Database:      localhost:1521 (Servicio: FREEPDB1)
```

---

## 11. Conclusiones Arquitectónicas

1. **Separación de Responsabilidades y Escalabilidad**: El desacoplamiento entre el cliente SPA en Angular y el API REST en Spring Boot permite escalar cada capa de forma independiente y sustituir o actualizar componentes sin afectar la continuidad operativa.
2. **Seguridad y Confianza**: La adopción de **Keycloak 26.1** centraliza la identidad y elimina la manipulación insegura de contraseñas en bases de datos locales, implementando el estándar internacional **OAuth 2.0 / JWT**.
3. **Robustez Transaccional**: La base de datos relacional **Oracle 23c Free** garantiza integridad ACID en el cálculo financiero de planillas y la amortización de adelantos, evitando descuadres contables.
4. **Portabilidad Total**: La infraestructura descrita en `docker-compose.yml` asegura que el sistema se ejecute de manera idéntica en entornos de desarrollo local, servidores de evaluación académica o infraestructura cloud de producción.
