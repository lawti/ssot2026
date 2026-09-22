import express from "express";
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env['PORT'] || 3000;

const pool = new Pool({
    host: process.env['DB_HOST'],
    port: parseInt(process.env['DB_PORT'] || '5432'),
    database: process.env['DB_NAME'],
    user: process.env['DB_USER'],
    password: process.env['DB_PASSWORD'],
});

// 1. Diccionario SSOT de casteo y tipos soportados
const casters = {
    text: (val: any) => (val ?? null) as string | null,
    integer: (val: any) => (val !== undefined && val !== '' && val !== null ? parseInt(val, 10) : null),
    boolean: (val: any) => val === 'true' || val === 'on' || val === true,
} as const;

type TipoDato = keyof typeof casters;

// Función de casteo estricta
function castearValor(valor: any, tipo: TipoDato) {
    return casters[tipo](valor);
}

// Renderizado de campos para el formulario
function renderInput(nombreCol: string, tipo: TipoDato, valorActual: any, esPk: boolean): string {
    // Si es PK: mostramos texto plano para que no parezca un input, y enviamos el dato vía hidden
    if (esPk) {
        return `
            <span style="font-weight: bold; color: #333; padding: 3px 0;">${valorActual ?? ''}</span>
            <input type="hidden" name="${nombreCol}" value="${valorActual ?? ''}">
        `;
    }

    if (tipo === 'boolean') {
        const checked = valorActual === true || valorActual === 't' ? 'checked' : '';
        return `<input type="checkbox" name="${nombreCol}" value="true" ${checked}>`;
    }
    if (tipo === 'integer') {
        return `<input type="number" name="${nombreCol}" value="${valorActual ?? ''}" required>`;
    }
    return `<input type="text" name="${nombreCol}" value="${valorActual ?? ''}" required>`;
}

type DefTabla = {
    campos: Record<string, { tipo: TipoDato }>
    pk: string[]
}

const ssot = {
    tablas: {
        materias: {
            campos: {
                cod_mat: { tipo: 'text' },
                materia: { tipo: 'text' },
                obligatoria: { tipo: 'boolean' },
                plan: { tipo: 'integer' },
            },
            pk: ['cod_mat']
        } satisfies DefTabla,
        pabellones: {
            campos: {
                pab: { tipo: 'text' },
                pabellon: { tipo: 'text' },
                pisos: { tipo: 'integer' },
            },
            pk: ['pab']
        } satisfies DefTabla
    }
}

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Menú principal
app.get('/menu', (_, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <title>SSOT2026 - Menú</title>
            <style>
                body { font-family: sans-serif; margin: 2rem; }
                ul { line-height: 1.8; }
            </style>
        </head>
        <body>
            <h2>SSOT2026 - Solo Somos Otros Tenaces</h2>
            <h3>Tablas disponibles:</h3>
            <ul>
                ${Object.keys(ssot.tablas).map(tabla => `
                    <li>
                        <strong>${tabla}:</strong> 
                        <a href="/poc/lista-${tabla}">Ver listado</a>
                    </li>
                `).join('')}
            </ul>
            <br>
            <a href="/poc/inter">Ir al formulario de materias</a>
        </body>
        </html>
    `);
});

// Formulario de prueba inicial para materias
app.get('/poc/inter', (_, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <title>Registrar Materia</title>
            <style>
                body { font-family: sans-serif; margin: 2rem; }
                form { display: flex; flex-direction: column; width: 300px; gap: 10px; }
                label { display: flex; justify-content: space-between; align-items: center; }
                select { width: 160px; padding: 2px; }
            </style>
        </head>
        <body>
            <h2>Registrar Materia</h2>
            <form method="POST" action="/poc/materias/crear">
                <label>
                    Código:
                    <input type="text" name="cod_mat" required placeholder="Ej: BD">
                </label>
                <label>
                    Materia:
                    <input type="text" name="materia" required placeholder="Ej: Base de Datos">
                </label>
                <label>
                    Plan:
                    <select name="plan" required>
                        <option value="" disabled selected>Seleccione un plan</option>
                        <option value="1993">1993</option>
                        <option value="2023">2023</option>
                    </select>
                </label>
                <label>
                    Obligatoria:
                    <input type="checkbox" name="obligatoria" value="true">
                </label>
                <button type="submit">Guardar Materia</button>
            </form>
            <br>
            <a href="/poc/lista-materias">Ver lista de materias</a>
            <br>
            <a href="/menu">Volver al menú</a>
        </body>
        </html>
    `);
});

// Bucle genérico SSOT: Listar, Crear, Formulario Edición, Actualizar
Object.entries(ssot.tablas).forEach(([tabla, def]: [string, DefTabla]) => {
    const columnas = Object.keys(def.campos);

    // 1. LISTAR: Con columna de acción "Editar"
    app.get(`/poc/lista-${tabla}`, async (_, res) => {
        try {
            const result = await pool.query(`
                SELECT ${columnas.join(', ')} 
                FROM ssot.${tabla}
                ORDER BY ${def.pk.join(', ')}
            `);

            res.send(`
                <h2>Listado de ${tabla}</h2>
                <table border="1" cellpadding="6" style="border-collapse: collapse;">
                    <tr>
                        ${columnas.map(title => `<th>${title}</th>`).join('')}
                        <th>Acciones</th>
                    </tr>
                    ${result.rows.map((row: Record<string, any>) => {
                const pkParams = def.pk.map(k => `${encodeURIComponent(k)}=${encodeURIComponent(row[k])}`).join('&');
                return `
                            <tr>
                                ${columnas.map(col => `<td>${row[col] ?? ''}</td>`).join('')}
                                <td><a href="/poc/form-editar-${tabla}?${pkParams}">Editar</a></td>
                            </tr>
                        `;
            }).join('')}
                </table>
                <br>
                <a href="/menu">Volver al menú</a>
            `);
        } catch (error) {
            console.error(`Error al listar ${tabla}:`, error);
            res.status(500).send(`Error al consultar ${tabla}: ${(error as Error).message}`);
        }
    });

    // 2. CREAR (INSERT genérico)
    app.post(`/poc/${tabla}/crear`, async (req, res) => {
        try {
            const valores = columnas.map(col => {
                const campo = def.campos[col];
                if (!campo) {
                    throw new Error(`Definición no encontrada para la columna "${col}".`);
                }
                return castearValor(req.body[col], campo.tipo);
            });

            const placeholders = columnas.map((_, i) => `$${i + 1}`).join(', ');
            const query = `
                INSERT INTO ssot.${tabla} (${columnas.join(', ')})
                VALUES (${placeholders})
                RETURNING *
            `;

            const result = await pool.query(query, valores);

            res.send(`
                <h3>Registro creado con éxito en ssot.${tabla}</h3>
                <pre>${JSON.stringify(result.rows[0], null, 2)}</pre>
                <p>
                    <a href="/poc/inter">Volver al formulario</a> | 
                    <a href="/poc/lista-${tabla}">Ver listado de ${tabla}</a> | 
                    <a href="/menu">Menú principal</a>
                </p>
            `);
        } catch (error) {
            console.error(`Error al insertar en ${tabla}:`, error);
            res.status(500).send(`
                <h3 style="color: red;">Error al insertar en ${tabla}</h3>
                <p>${(error as Error).message}</p>
                <a href="/poc/inter">Volver</a>
            `);
        }
    });

    // 3. FORMULARIO DE EDICIÓN GENÉRICO
    app.get(`/poc/form-editar-${tabla}`, async (req, res) => {
        try {
            const wherePk = def.pk.map((k, i) => `${k} = $${i + 1}`).join(' AND ');
            const valoresPk = def.pk.map(k => {
                const campo = def.campos[k];
                if (!campo) {
                    throw new Error(`Clave primaria "${k}" no definida en campos.`);
                }
                return castearValor(req.query[k], campo.tipo);
            });

            const result = await pool.query(
                `SELECT ${columnas.join(', ')} FROM ssot.${tabla} WHERE ${wherePk} LIMIT 1`,
                valoresPk
            );

            if (result.rows.length === 0) {
                res.status(404).send('Registro no encontrado.');
                return;
            }

            const registro = result.rows[0];

            res.send(`
                <!DOCTYPE html>
                <html lang="es">
                <head>
                    <meta charset="UTF-8">
                    <title>Editar ${tabla}</title>
                    <style>
                        body { font-family: sans-serif; margin: 2rem; }
                        form { display: flex; flex-direction: column; width: 320px; gap: 10px; }
                        label { display: flex; justify-content: space-between; align-items: center; }
                        input[type="text"], input[type="number"] { width: 160px; padding: 2px; }
                    </style>
                </head>
                <body>
                    <h2>Editar ${tabla}</h2>
                    <form method="POST" action="/poc/${tabla}/actualizar">
                        ${columnas.map(col => {
                const campo = def.campos[col];
                if (!campo) return '';
                const esPk = def.pk.includes(col);
                return `
                                <label>
                                    ${col}${esPk ? ' (PK)' : ''}:
                                    ${renderInput(col, campo.tipo, registro[col], esPk)}
                                </label>
                            `;
            }).join('')}
                        <button type="submit" style="margin-top: 10px;">Guardar Cambios</button>
                    </form>
                    <br>
                    <a href="/poc/lista-${tabla}">Cancelar y volver</a>
                </body>
                </html>
            `);
        } catch (error) {
            console.error(`Error al cargar datos para edición en ${tabla}:`, error);
            res.status(500).send(`Error: ${(error as Error).message}`);
        }
    });

    // 4. ACTUALIZAR (UPDATE genérico)
    app.post(`/poc/${tabla}/actualizar`, async (req, res) => {
        try {
            const columnasModificables = columnas.filter(col => !def.pk.includes(col));
            const columnasPk = def.pk;

            if (columnasModificables.length === 0) {
                res.status(400).send('La tabla no posee columnas actualizables fuera de su clave primaria.');
                return;
            }

            // Mapeo seguro con casteo estricto para SET y WHERE
            const valoresSet = columnasModificables.map(col => {
                const campo = def.campos[col];
                if (!campo) throw new Error(`Definición no encontrada para la columna "${col}".`);
                return castearValor(req.body[col], campo.tipo);
            });

            const valoresPk = columnasPk.map(col => {
                const campo = def.campos[col];
                if (!campo) throw new Error(`Definición no encontrada para la clave "${col}".`);
                return castearValor(req.body[col], campo.tipo);
            });

            // Generación de cláusulas SQL con índices posicionales
            const setClause = columnasModificables.map((col, i) => `${col} = $${i + 1}`).join(', ');
            const offset = columnasModificables.length;
            const whereClause = columnasPk.map((pkCol, i) => `${pkCol} = $${offset + i + 1}`).join(' AND ');

            const query = `
                UPDATE ssot.${tabla}
                SET ${setClause}
                WHERE ${whereClause}
                RETURNING *
            `;

            const result = await pool.query(query, [...valoresSet, ...valoresPk]);

            if (result.rowCount === 0) {
                res.status(404).send('Registro no encontrado para actualizar.');
                return;
            }

            res.send(`
                <h3>Registro actualizado con éxito en ssot.${tabla}</h3>
                <pre>${JSON.stringify(result.rows[0], null, 2)}</pre>
                <p>
                    <a href="/poc/lista-${tabla}">Volver al listado de ${tabla}</a> | 
                    <a href="/menu">Menú principal</a>
                </p>
            `);
        } catch (error) {
            console.error(`Error al actualizar en ${tabla}:`, error);
            res.status(500).send(`
                <h3 style="color: red;">Error al actualizar en ${tabla}</h3>
                <p>${(error as Error).message}</p>
                <a href="/poc/lista-${tabla}">Volver al listado</a>
            `);
        }
    });
});

app.listen(port, (error) => {
    if (error) throw error;
    console.log(`SSOT2026 escuchando en http://localhost:${port}/menu`);
});