import { FastifyRequest, FastifyReply } from "fastify";
import { PokemonWithStats } from "models/PokemonWithStats";
const https = require('https');
const url = require('url');
const keepAliveAgent = new https.Agent({ keepAlive: true });


// unfortunately, the pokemon api is not accepting requests from http anymore, must switch to https
// i have noticed that the exercice may still use v1, due the computeResponse function
// i don't change the functionality of the function,
// so i keep it as is, but i use nullable types to not get errors

function httpRequest({ hostname, pathname, headers  }): Promise<unknown>{
  return new Promise((resolve, reject) => {
    let re = https.request({
      'agent': keepAliveAgent,
      'method': 'GET',
      'hostname': hostname,
      'path': pathname,
      'headers': {
        ...headers
      },
    }, function (res) {
      if(res.statusCode === 200){
        let chunks: any = [];
        res.on('data', function (chunk) {
          chunks.push(chunk);
        });
        res.on('end', () => {
          let result = Buffer.concat(chunks).toString();
          resolve(JSON.parse(result));
        });
        res.on('error', (error) => {
          reject(error);
        })
      } else
        resolve(null);
    }).end();
  })
}

export async function getPokemonByName(request: FastifyRequest, reply: FastifyReply) {
  var name: string = request.params['name'] || '';
  reply.headers['Accept'] = 'application/json'

  var urlApiPokeman = `https://pokeapi.co/api/v2/pokemon`;

  name === null || name.trim() === '' ?
        (urlApiPokeman = urlApiPokeman + '?offset=20&limit=20') :
        (urlApiPokeman =  `${urlApiPokeman}/${name.trim()}`);


  let response: any = "";
  try {
    response = await httpRequest({
        hostname: url.parse(urlApiPokeman).hostname,
        pathname: url.parse(urlApiPokeman).path,
        headers: {}
    });
    if (response == null) {
      reply.code(404);
      return reply.send({
        error: 'Pokemon not found'
      })
    } else {
      computeResponse (response, reply)
      reply.send(response);
    }
  } catch (error) {
    reply.send(error);
  }
  return reply
}

export const computeResponse = async (response: any, reply: FastifyReply) => {
  const resp = response as any
  let types = resp.types?.map(type => type.type).map(type => { return type.url }).reduce((types, typeUrl) => [...types, typeUrl ], []);
  let pokemonTypes = []

  pokemonTypes = Array.isArray(types) && types.length > 0 ? await Promise.all(types.map(element => {
    return httpRequest({
      hostname: url.parse(element).hostname,
      pathname: url.parse(element).path,
      headers: {}
    });
  })) : undefined;
  if (pokemonTypes === undefined)
    throw new Error('Pokemon types not found');

  response.stats?.forEach(element => {
    let stats = []
    pokemonTypes.map(pok =>
      pok.stats?.map(st =>
        st.stat.name.toUpperCase() == element.stat.name
          ? stats.push(st.base_state)
          : ([])
      )
    )

    if (stats) {
      let avg = stats?.reduce((a, b) => a + b, 0) / stats.length
      element.averageStat = avg
    } else {
      element.averageStat = 0
    }
  });
}