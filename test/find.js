
describe('Usage without postgres', () => {
  let uuidSimple, uuidSimpleRelationship, uuidRelationshipArray, uuidRelationshipArrayOfOneElement
  let simple = {
      _label: 'AghanimTest',
      stringProperty: 'test'
    },
    simpleRelationship = {
      _label: 'AghanimTest',
      name: 'Ezalor',
      origin: {
        _label: 'AghanimTest',
        name: 'Elder Titan'
      }
    },
    relationshipArray = {
      _label: 'AghanimTest',
      name: 'Fundamentals',
      entities: [{
        _label: 'AghanimTest',
        name: 'Enigma'
      }, {
        _label: 'AghanimTest',
        name: 'Io'
      }, {
        _label: 'AghanimTest',
        name: 'Chaos Knight'
      }]
    },
    relationshipArrayOfOneElement = {
      _label: 'AghanimTest',
      property: 'value',
      relationship: [{
        _label: 'AghanimTest',
        other: 2
      }]
    }
  before(() => {
    aghanim = new Aghanim()
  })

  beforeEach((done) => {
    aghanim.save([
      simple,
      {
        _label: 'AghanimTest',
        numberProperty: 1
      },
      {
        _label: 'AghanimTest',
        booleanProperty: true
      },
      {
        _label: 'AghanimTest',
        booleanProperty: false
      },
      {
        _label: 'AghanimTest',
        listProperty: [1, 2, 3]
      },
      {
        _label: 'AghanimTest',
        listProperty: ['a', 'b', 'c']
      },
      simpleRelationship,
      relationshipArray,
      relationshipArrayOfOneElement], (err, uuids) => {
      if (err) return done(err)

      uuidSimple = uuids[0]
      uuidSimpleRelationship = uuids[6]
      uuidRelationshipArray = uuids[7]
      uuidRelationshipArrayOfOneElement = uuids[8]
      done()
    })
  })

  afterEach((done) => {
    aghanim.deleteNodesByQueryObject({
      label: 'AghanimTest'
    }, done)
  })

  it('simple object', (done) => {
    aghanim.findById(uuidSimple, (err, result) => {
      if (err) done(err)
      expect(result).to.be.deep.equal({
        uuid: uuidSimple,
        ...simple
      })
      done()
    })
  })

  it('object with relationship array', (done) => {
    aghanim.findById(uuidRelationshipArray, (err, result) => {
      if (err) done(err)
      expect(result).to.be.an('object')
      expect(result).to.have.property('_label', 'AghanimTest')
      expect(result).to.have.property('name', 'Fundamentals')
      expect(result).to.have.property('entities').that.is.an('array').that.have.lengthOf(3)
      expect(_.map(result.entities, '_label')).to.be.deep.equal(['AghanimTest', 'AghanimTest', 'AghanimTest'])
      expect(_.map(result.entities, 'name').sort()).to.be.deep.equal(['Chaos Knight', 'Enigma', 'Io'])

      done()
    })
  })

  it('object with relationship array of one element', (done) => {
    aghanim.findById(uuidRelationshipArrayOfOneElement, (err, result) => {
      if (err) done(err)
      expect(result).to.be.an('object')
      expect(result).to.have.property('_label', 'AghanimTest')
      expect(result).to.have.property('relationship').that.is.an('array').that.have.lengthOf(1)
      expect(result.relationship[0]).to.have.property('_label', 'AghanimTest')
      expect(result.relationship[0]).to.have.property('other', 2)
      expect(result.relationship[0]).to.have.property('uuid')
      done()
    })
  })
})
