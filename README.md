# 📖 Beatrice

Beatrice é uma API GraphQL desenvolvida com o intuito de estudar e participar de um projeto de Trabalho de Graduação (TG) do Ensino Superior. O foco principal é o monitoramento de ambientes (recintos) através de dados coletados por sensores.

## 🚀 Funcionamento do Projeto

O projeto funciona como uma ponte entre os sensores (ou dispositivos que coletam dados) e uma interface de usuário.

### 🛠️ Tecnologias Utilizadas

- **Node.js & Express:** Base para o servidor web.
- **Apollo Server:** Implementação do servidor GraphQL para gerenciar consultas e mutações.
- **Firebase Firestore:** Banco de dados NoSQL utilizado para persistência dos dados em tempo real.
- **GraphQL Tools:** Utilizado para modularizar e carregar esquemas e resolvers de forma eficiente.

### 🏗️ Arquitetura

A estrutura do código é organizada da seguinte forma:

- **`src/schemas/`**: Contém as definições de tipos do GraphQL (`.graphql`). Define quais dados podem ser consultados (Query) ou alterados (Mutation).
- **`src/resolvers/`**: Contém a lógica de implementação para cada campo definido no schema. É aqui que as chamadas ao banco de dados Firestore são realizadas.
- **`src/config/`**: Configurações de serviços externos, como a conexão com o Firebase.
- **`src/index.js` & `src/app.js`**: Ponto de entrada da aplicação e configuração do servidor Apollo.

### 📊 Fluxo de Dados

1. **Mutations**: Permitem o registro de novos dados de sensores (ex: `createVariant`), que incluem temperatura, umidade, ruído e luminosidade.
2. **Queries**: Permitem a consulta dos últimos dados registrados para um determinado recinto (ex: `latestVariants`).
3. **Firestore**: Todos os dados são armazenados em coleções no Firebase, facilitando o acesso escalável e em tempo real.

## 🏁 Como Iniciar

1. Instale as dependências: `npm install`
2. Copie `.env.example` para `.env` e configure as variáveis obrigatórias:
   - `FIREBASE_KEY_PATH` ou `FIREBASE_SERVICE_ACCOUNT`
   - `JWT_SECRET`
   - `PORT` (opcional, padrão `4000`)
3. Inicie o servidor: `npm start` (ou `node src/index.js`)
4. Valide antes de publicar:
   ```bash
   npm run check
   npm test
   ```

Variáveis obrigatórias:

- `JWT_SECRET`: segredo usado para assinar e validar tokens JWT. Em produção, use um valor longo e aleatório.
- `FIREBASE_KEY_PATH`: caminho para o arquivo JSON da service account em desenvolvimento local.
- `FIREBASE_SERVICE_ACCOUNT`: alternativa recomendada para deploy; informe o JSON da service account em uma única variável de ambiente.

No Render, configure pelo painel do serviço em **Environment**:

- `JWT_SECRET`
- `FIREBASE_SERVICE_ACCOUNT`

![BEATRICE](https://media.tenor.com/I-2_kJDfAIUAAAAM/re-zero-beatrice.gif)
