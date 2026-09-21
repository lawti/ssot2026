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
    res.send('SSOT2026 - Solo Somos Otros Tenaces en 2026');
})

app.get('/poc/inter', (_, res) => {
    res.send(`
        <form method=post action="/poc/api/inter">
            <p>Esta es una prueba de concepto</p>
            <p><label>dato:<input name=dato></label></p>
            <input type=submit value="Procesar">
        </form>
    `)
})

app.post('/poc/api/inter', async (req, res) => {
    console.log('POST', '/poc/api/inter')
    console.log(req.query);
    res.send(`
        <H2>recibido</H2>
    `)
    console.log(await req.body);
})

app.get('/poc/materias', async (_, res) => {
  try {
    const result = await pool.query('SELECT * FROM ssot.materias');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching subjects:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// No anda
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
    </table>`)
    })
});


app.listen(port, (error) => {
    if (error) throw error;
    console.log(`SSOT2026 escuchando en http://localhost:${port}/menu`);
});
