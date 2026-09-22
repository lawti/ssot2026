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

// Función de casteo tipada de forma estricta
function castearValor(valor: any, tipo: TipoDato) {
    return casters[tipo](valor);
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

// Menú principal con enlaces dinámicos según ssot.tablas
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

// Formulario de prueba para materias
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

// Endpoints genéricos para Listar y Agregar por cada tabla
Object.entries(ssot.tablas).forEach(([tabla, def]: [string, DefTabla]) => {
    const columnas = Object.keys(def.campos);

    // 1. LISTAR: Lee las columnas en el orden exacto definido en el SSOT
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
                    </tr>
                    ${result.rows.map((row: Record<string, any>) => `
                        <tr>
                            ${columnas.map(col => `<td>${row[col] ?? ''}</td>`).join('')}
                        </tr>
                    `).join('')}
                </table>
                <br>
                <a href="/menu">Volver al menú</a>
            `);
        } catch (error) {
            console.error(`Error al listar ${tabla}:`, error);
            res.status(500).send(`Error al consultar ${tabla}: ${(error as Error).message}`);
        }
    });

    // 2. AGREGAR (INSERT): Aplica el casteo dinámico a cada columna
    app.post(`/poc/${tabla}/crear`, async (req, res) => {
        try {
            // Mapeo seguro: cada valor pasa por su caster según el tipo registrado en el SSOT
            const valores = columnas.map(col => {
                const campo = def.campos[col];
                if (!campo) {
                    throw new Error(`Definición no encontrada para la columna "${col}" en la tabla "${tabla}".`);
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
});

app.listen(port, (error) => {
    if (error) throw error;
    console.log(`SSOT2026 escuchando en http://localhost:${port}/menu`);
});