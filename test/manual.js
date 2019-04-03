const Aghanim = require('../lib')
const aghanim = new Aghanim({
  user: 'agens',
  pass: 'agens',
  db: 'agens'
})

async function run () {
  await aghanim.connect('agens_graph')
  await aghanim.cre
}
