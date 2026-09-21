import express from "express";
import { Pool } from 'pg'
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


type DefTabla = {
    campos: Record<string, { tipo: string }>
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

app.get('/menu', (_, res) => {
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
            <h2>SSOT2026 - Solo Somos Otros Tenaces </h2>
            <a href="/poc/lista-materias">Ver lista de materias</a>
            <br>
            <a href="/poc/inter">Ir al formulario</a>
        </body>
        </html>
        `);
})

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
            <a href="/menu">Volver al menu</a>
        </body>
        </html>
    `);
});

app.post('/poc/api/inter', async (req, res) => {
    console.log('POST', '/poc/api/inter')
    console.log(req.query);
    res.send(`
        <H2>recibido</H2>
    `)
    console.log(await req.body);
})


Object.entries(ssot.tablas).forEach(([tabla, def]: [string, DefTabla]) => {

    app.get(`/poc/lista-${tabla}`, async (_, res) => {
        const result = await pool.query(`
        SELECT ${Object.keys(def.campos).join(',')} 
            FROM ssot.${tabla}
            ORDER BY ${def.pk}
    `);
        res.send(`<table>
            <tr>
                ${Object.keys(def.campos).map(title =>
            `<th>${title}</th>`
        ).join('')}
            </tr>
        ${result.rows.map((row: Record<string, any>) =>
            `<tr>
                ${Object.entries(row).map(([_, value]: string[]) =>
                `<td>${value}</td>`
            ).join('')}
            </tr>`
        ).join('')}
    </table>
    <a href="/menu">Volver al menu</a>`)
    });

    app.post(`/poc/${tabla}/crear`, async (req, res) => {
        try {
            const columnas = Object.keys(def.campos);

            // Mapeo y casteo automático según el tipo definido en ssot
            const valores = columnas.map(col => {
                const valor = req.body[col];
                const tipo = def.campos[col]?.tipo;

                if (tipo === 'boolean') {
                    return valor === 'true' || valor === 'on';
                }
                if (tipo === 'integer') {
                    return valor !== undefined && valor !== '' ? parseInt(valor, 10) : null;
                }
                return valor ?? null;
            });

            // Genera "$1, $2, $3, ..."
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
                    <a href="/poc/lista-${tabla}">Ver listado de ${tabla}</a>
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
