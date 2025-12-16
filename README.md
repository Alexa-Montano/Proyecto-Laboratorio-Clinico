# Proyecto-Laboratorio-Clinico
El proyecto propuesto consiste en el desarrollo de un sistema web para la gestión integral de un laboratorio clínico, el cual permitirá administrar de manera centralizada la información de pacientes, médicos y estudios médicos, considerando distintos roles de usuario con permisos específicos.
# Objetivo del proyecto
El objetivo de esta practica es desarrollar una plataforma web para la gestión y entrega de resultados de estudios médicos en un laboratorio clínico, que permita administrar la información de pacientes, médicos y estudios de manera segura, eficiente y organizada. 
La página:
- Implementa módulos para la administración de pacientes, médicos y estudios médicos.
- Desarrolla el control de acceso y autenticación según el rol del usuario.
- Permite la consulta y entrega digital de resultados médicos.
# Estructura del proyecto
```
PROYECTO_LABORATORIO/
│
├── laboratorio/
│   │
│   ├── node_modules/
│   │
│   ├── public/
│   │   │
│   │   ├── css/
│   │   │   └── styles.css
│   │   │
│   │   ├── img/
│   │   │   ├── logo.png
│   │   │   └── resultados/
│   │   │
│   │   ├── busquedas.html
│   │   ├── dashboard.html
│   │   ├── estudio_nuevo.html
│   │   ├── estudios.html
│   │   ├── index.html
│   │   ├── login.html
│   │   ├── medico_nuevo.html
│   │   ├── medicos.html
│   │   ├── paciente_nuevo.html
│   │   ├── pacientes.html
│   │   ├── registro.html
│   │   └── resultados.html
│   │
│   ├── package.json
│   ├── package-lock.json
│   └── server.js

```

# Base de datos
La base de datos para este proyecto fue creada con el nombre de laboratorio. Esta base de datos contiene las siguientes tablas.
mysql> show tables;

```
+-----------------------+
| Tables_in_laboratorio |
+-----------------------+
| citas                 |
| codigos_rol           |
| estudios              |
| medicos               |
| pacientes             |
| resultados            |
| usuarios              |
+-----------------------+
```
Estructura de las tablas.
```
mysql> describe usuarios;
+---------------+-------------------------------------+------+-----+---------+----------------+
| Field         | Type                                | Null | Key | Default | Extra          |
+---------------+-------------------------------------+------+-----+---------+----------------+
| id            | int                                 | NO   | PRI | NULL    | auto_increment |
| nombre        | varchar(100)                        | NO   |     | NULL    |                |
| correo        | varchar(150)                        | NO   | UNI | NULL    |                |
| password_hash | varchar(150)                        | NO   |     | NULL    |                |
| rol           | enum('admin','asistente','cliente') | NO   |     | NULL    |                |
+---------------+-------------------------------------+------+-----+---------+----------------+
mysql> describe resultados;
+---------------+--------------------------------+------+-----+-------------------+-------------------+
| Field         | Type                           | Null | Key | Default           | Extra             |
+---------------+--------------------------------+------+-----+-------------------+-------------------+
| id            | int                            | NO   | PRI | NULL              | auto_increment    |
| cita_id       | int                            | YES  | UNI | NULL              |                   |
| valores       | text                           | YES  |     | NULL              |                   |
| observaciones | text                           | YES  |     | NULL              |                   |
| archivo       | varchar(255)                   | YES  |     | NULL              |                   |
| estado        | enum('pendiente','disponible') | YES  |     | pendiente         |                   |
| fecha_subida  | timestamp                      | YES  |     | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
+---------------+--------------------------------+------+-----+-------------------+-------------------+

mysql> describe pacientes;
+------------------+--------------+------+-----+---------+----------------+
| Field            | Type         | Null | Key | Default | Extra          |
+------------------+--------------+------+-----+---------+----------------+
| id               | int          | NO   | PRI | NULL    | auto_increment |
| nombre           | varchar(100) | NO   |     | NULL    |                |
| correo           | varchar(150) | YES  |     | NULL    |                |
| telefono         | varchar(20)  | YES  |     | NULL    |                |
| fecha_nacimiento | date         | YES  |     | NULL    |                |
+------------------+--------------+------+-----+---------+----------------+

mysql> describe citas;
+------------+-----------------------------------------+------+-----+----------+----------------+
| Field      | Type                                    | Null | Key | Default  | Extra          |
+------------+-----------------------------------------+------+-----+----------+----------------+
| id         | int                                     | NO   | PRI | NULL     | auto_increment |
| usuario_id | int                                     | NO   | MUL | NULL     |                |
| estudio_id | int                                     | NO   | MUL | NULL     |                |
| fecha      | date                                    | NO   |     | NULL     |                |
| hora       | time                                    | NO   |     | NULL     |                |
| estado     | enum('Agendada','Cancelada','Atendida') | YES  |     | Agendada |                |
+------------+-----------------------------------------+------+-----+----------+----------------+

mysql> describe codigos_rol;
+--------+-------------------------------------+------+-----+---------+----------------+
| Field  | Type                                | Null | Key | Default | Extra          |
+--------+-------------------------------------+------+-----+---------+----------------+
| id     | int                                 | NO   | PRI | NULL    | auto_increment |
| codigo | varchar(50)                         | NO   | UNI | NULL    |                |
| rol    | enum('admin','asistente','cliente') | NO   |     | NULL    |                |
| activo | tinyint(1)                          | YES  |     | 1       |                |
+--------+-------------------------------------+------+-----+---------+----------------+

mysql> describe estudios;
+-------------+---------------+------+-----+---------+----------------+
| Field       | Type          | Null | Key | Default | Extra          |
+-------------+---------------+------+-----+---------+----------------+
| id          | int           | NO   | PRI | NULL    | auto_increment |
| nombre      | varchar(100)  | NO   |     | NULL    |                |
| descripcion | text          | YES  |     | NULL    |                |
| precio      | decimal(10,2) | NO   |     | NULL    |                |
+-------------+---------------+------+-----+---------+----------------+

mysql> describe medicos;
+--------------------+--------------+------+-----+---------+----------------+
| Field              | Type         | Null | Key | Default | Extra          |
+--------------------+--------------+------+-----+---------+----------------+
| id                 | int          | NO   | PRI | NULL    | auto_increment |
| nombre             | varchar(100) | NO   |     | NULL    |                |
| especialidad       | varchar(100) | NO   |     | NULL    |                |
| cedula_profesional | varchar(50)  | NO   |     | NULL    |                |
+--------------------+--------------+------+-----+---------+----------------+

```
