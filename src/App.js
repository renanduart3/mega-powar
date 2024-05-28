import React, { useState, useEffect } from 'react';
import { Container, Form, Button, ListGroup, Spinner, Table } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import { openDB } from 'idb';

const App = () => {
  const [resultados, setResultados] = useState([]);
  const [dezenasMaisSaidas, setDezenasMaisSaidas] = useState([]);
  const [numerosGerados, setNumerosGerados] = useState([]);
  const [inputNumeros, setInputNumeros] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [jogos, setJogos] = useState([]);

  useEffect(() => {
    (async () => {
      const db = await openDB('MegaSenaDB', 1, {
        upgrade(db) {
          db.createObjectStore('jogos', { keyPath: 'id', autoIncrement: true });
        },
      });
      const allJogos = await db.getAll('jogos');
      setJogos(allJogos.slice(-10).reverse());
    })();
  }, []);

  const buscarResultados = () => {
    setIsLoading(true);
    fetch('https://loteriascaixa-api.herokuapp.com/api/megasena')
      .then(response => response.json())
      .then(data => {
        setResultados(data);
        calcularDezenasMaisSaidas(data);
        setIsLoading(false);
      })
      .catch(error => {
        console.error('Erro ao buscar dados:', error);
        setIsLoading(false);
      });
  };

  const calcularDezenasMaisSaidas = (dados) => {
    let contagemDezenas = {};
    dados.forEach(resultado => {
      resultado.dezenas.forEach(dezena => {
        contagemDezenas[dezena] = (contagemDezenas[dezena] || 0) + 1;
      });
    });
    let dezenasOrdenadas = Object.keys(contagemDezenas).sort((a, b) => contagemDezenas[b] - contagemDezenas[a]);
    setDezenasMaisSaidas(dezenasOrdenadas.slice(0, 10));
  };

  const shuffleArray = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  };

  const gerarNumeros = async () => {
    let numerosIniciais = inputNumeros.split(',').map(num => num.trim()).filter(num => num);
    let novosNumeros = [...numerosIniciais];
    let restantes = 6 - novosNumeros.length;

    if (restantes > 0) {
      let topDezenas = dezenasMaisSaidas.filter(dezena => !novosNumeros.includes(dezena));
      shuffleArray(topDezenas);

      for (let i = 0; i < Math.min(restantes, 3); i++) {
        if (topDezenas.length > 0) {
          novosNumeros.push(topDezenas.shift());
        }
      }

      while (novosNumeros.length < 6) {
        let numeroAleatorio = (Math.floor(Math.random() * 60) + 1).toString();
        if (!novosNumeros.includes(numeroAleatorio)) {
          novosNumeros.push(numeroAleatorio);
        }
      }
    }

    setNumerosGerados(novosNumeros);

    // Check if the generated numbers have been drawn before
    const sortedNumbers = novosNumeros.sort().join(', ');
    let jaSorteado = null;
    for (let resultado of resultados) {
      if (resultado.dezenas.sort().join(', ') === sortedNumbers) {
        jaSorteado = resultado.concurso;
        break;
      }
    }

    // Save the generated numbers to IndexedDB
    const db = await openDB('MegaSenaDB', 1);
    await db.add('jogos', { numeros: sortedNumbers, concurso: jaSorteado });

    // Update the list of games
    const allJogos = await db.getAll('jogos');
    setJogos(allJogos.slice(-10).reverse());
  };

  const apagarDados = async () => {
    const db = await openDB('MegaSenaDB', 1);
    await db.clear('jogos');
    setJogos([]);
  };

  const numeroUtilizadoTop10 = (numero, dezenasMaisSaidas) => {
    return dezenasMaisSaidas.includes(numero) ? 'utilizado-top-10' : 'numeros-normais';
  };

  return (
    <Container>
      <h2>Gerar Jogos Aleatórios</h2>
      <Form>
        <Form.Group controlId="numerosIniciais">
          <Form.Label>Insira números iniciais (separados por vírgula):</Form.Label>
          <Form.Control
            type="text"
            value={inputNumeros}
            onChange={e => setInputNumeros(e.target.value)}
          />
        </Form.Group>
        <Button variant="primary mt-1" onClick={gerarNumeros}>Gerar</Button>
      </Form>
      {numerosGerados.length > 0 && (
        <div className="mt-4">
          <h3>Números Gerados:</h3>
          <p>{numerosGerados.join(', ')}</p>
        </div>
      )}
      <h2>Últimos 10 Jogos Gerados</h2>
      <Table striped bordered hover className="mt-4">
        <thead>
          <tr>
            <th>#</th>
            <th>Números</th>
            <th>Observação</th>
          </tr>
        </thead>
        <tbody>
          {jogos.map((jogo, index) => (
            <tr key={jogo.id}>
              <td>{index + 1}</td>
              <td>
                {jogo.numeros.split(', ').map((numero, idx) => (
                  <span key={idx} className={numeroUtilizadoTop10(numero, dezenasMaisSaidas)}>{numero}</span>
                ))}
              </td>
              <td>
                {jogo.concurso ? `Já sorteado no concurso: ${jogo.concurso}` : 'Não sorteado ainda'}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      <Button variant="danger" onClick={apagarDados} className="mb-4">
        Apagar Dados
      </Button>

      <h1 className="mt-4">Resultados Mega-Sena</h1>
      <Button variant="primary" onClick={buscarResultados} className="mb-4">Buscar Resultados</Button>
      {isLoading ? (
        <div className="d-flex justify-content-center mb-4">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Loading...</span>
          </Spinner>
        </div>
      ) : (
        resultados.length > 0 && (
          <>
            <h2>Dezenas mais saídas</h2>
            <ListGroup className="mb-4">
              {dezenasMaisSaidas.map(dezena => (
                <ListGroup.Item key={dezena}>{dezena}</ListGroup.Item>
              ))}
            </ListGroup>

            <ListGroup className="mb-4">
              {resultados.map(resultado => (
                <ListGroup.Item key={resultado.concurso}>
                  Concurso: {resultado.concurso} - Data: {resultado.data}
                  <br />
                  Números sorteados: {resultado.dezenas.join(', ')}
                </ListGroup.Item>
              ))}
            </ListGroup>
          </>
        )
      )}

    </Container>
  );
};

export default App;
