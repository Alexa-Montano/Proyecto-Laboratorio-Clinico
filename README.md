# Proyecto-Laboratorio-Clinico
El proyecto propuesto consiste en el desarrollo de un sistema web para la gestión integral de un laboratorio clínico, el cual permitirá administrar de manera centralizada la información de pacientes, médicos y estudios médicos, considerando distintos roles de usuario con permisos específicos.
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
mysql> select * from codigos_rol;
+----+------------+-----------+--------+
| id | codigo     | rol       | activo |
+----+------------+-----------+--------+
|  1 | ADMIN-2025 | admin     |      1 |
|  2 | MED-2025   | asistente |      1 |
|  3 | PAC-2025   | cliente   |      1 |
+----+------------+-----------+--------+
```
