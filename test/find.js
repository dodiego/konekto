const Aghanim = require('../lib/index')
const chai = require('chai')
const _ = require('lodash')
chai.use(require('chai-things'))
let expect = chai.expect

let aghanim

describe('find', () => {
  describe('by id', () => {
    let uuidSimple, uuidSimpleRelationship, uuidRelationshipArray, uuidRelationshipArrayOfOneElement,
      simple = {
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
      (async () => {
        uuidSimple = await aghanim.save(simple)
        uuidSimpleRelationship = await aghanim.save(simpleRelationship)
        uuidRelationshipArray = await aghanim.save(relationshipArray)
        uuidRelationshipArrayOfOneElement = await aghanim.save(relationshipArrayOfOneElement)
        await aghanim.save({
          _label: 'AghanimTest',
          numberProperty: 1
        })
        await aghanim.save({
          _label: 'AghanimTest',
          booleanProperty: true
        })
        await aghanim.save({
          _label: 'AghanimTest',
          booleanProperty: false
        })
        await aghanim.save({
          _label: 'AghanimTest',
          listProperty: [1, 2, 3]
        })
        await aghanim.save({
          _label: 'AghanimTest',
          listProperty: ['a', 'b', 'c']
        })
        done()
      })()
    })

    afterEach((done) => {
      aghanim.remove({
        label: 'AghanimTest'
      }).then(done)
    })

    it('simple object', (done) => {
      (async () => {
        let result = await aghanim.findByUuid(uuidSimple)
        expect(result).to.be.deep.equal({
          uuid: uuidSimple,
          ...simple
        })
        done()
      })()
    })

    it('object with relationship array', (done) => {
      (async () => {
        let result = await aghanim.findByUuid(uuidRelationshipArray)
        expect(result).to.be.an('object')
        expect(result).to.have.property('_label', 'AghanimTest')
        expect(result).to.have.property('name', 'Fundamentals')
        expect(result).to.have.property('entities').that.is.an('array').that.have.lengthOf(3)
        expect(result.entities.map(e => e._label)).to.be.deep.equal(['AghanimTest', 'AghanimTest', 'AghanimTest'])
        expect(result.entities.map(e => e.name).sort()).to.be.deep.equal(['Chaos Knight', 'Enigma', 'Io'])
        done()
      })()
    })

    it('object with single object relationship', (done) => {
      (async () => {
        let result = await aghanim.findByUuid(uuidSimpleRelationship)
        expect(result).to.be.an('object')
        expect(result).to.have.property('_label', 'AghanimTest')
        expect(result).to.have.property('name', 'Ezalor')
        expect(result).to.have.property('origin').that.is.an('object').that.have.property('name', 'Elder Titan')
        done()
      })()
    })

    it('object with relationship array of one element', (done) => {
      (async () => {
        let result = await aghanim.findByUuid(uuidRelationshipArrayOfOneElement)
        expect(result).to.be.an('object')
        expect(result).to.have.property('_label', 'AghanimTest')
        expect(result).to.have.property('relationship').that.is.an('array').that.have.lengthOf(1)
        expect(result.relationship[0]).to.have.property('_label', 'AghanimTest')
        expect(result.relationship[0]).to.have.property('other', 2)
        expect(result.relationship[0]).to.have.property('uuid')
        done()
      })()
    })
  })
  describe('by query object', () => {
    let
      crystalMaiden = {
        _label: 'AghanimTest',
        name: 'Crystal Maiden',
        skills: [{
          _label: 'AghanimRelationshipTest',
          title: 'Crystal Nova'
        }, {
          _label: 'AghanimRelationshipTest',
          title: 'Frostbite'
        }, {
          _label: 'AghanimRelationshipTest',
          title: 'Arcane Aura'
        }, {
          _label: 'AghanimRelationshipTest',
          title: 'Freezing Field'
        }]
      },
      sven = {
        _label: 'AghanimTest',
        name: 'Sven',
        skills: [{
          _label: 'AghanimRelationshipTest',
          title: 'Storm Hammer',
          lore: {
            _label: 'AghanimRelationshipTest',
            text: 'The Rogue Knight\'s iron gauntlet, taken from the school of his father, strikes his foes to their core.'
          }
        }, {
          _label: 'AghanimRelationshipTest',
          title: 'God\'s strength'
        }]
      },
      data = [{
        _label: 'AghanimTest',
        name: '0name1$'
      }, {
        _label: 'AghanimTest',
        name: '0name2$'
      }, {
        _label: 'AghanimTest',
        name: '0name3$'
      }, {
        _label: 'AghanimTest',
        number: 10
      }, {
        _label: 'AghanimTest',
        number: 15
      }, {
        _label: 'AghanimTest',
        number: 20
      }, {
        _label: 'AghanimTest',
        boolean: true
      }, {
        _label: 'AghanimTest',
        boolean: false
      }, {
        _label: 'AghanimTest',
        nullable: null
      }, {
        _label: 'AghanimTest',
        list: [1, 2, 3]
      }, {
        _label: 'AghanimTest',
        list: [4, 5, 6]
      }, {
        _label: 'AghanimTest',
        list: [1, 4]
      }, {
        _label: 'OtherLabelTest',
        property: 'value',
        rel: {
          _label: 'AghanimRelationshipTest',
          property: 'value'
        }
      }, crystalMaiden, sven],
      aghanimTestLength = data.length - 1

    before(() => {
      aghanim = new Aghanim()
    })

    beforeEach((done) => {
      (async () => {
        await aghanim.remove({
          label: ['AghanimTest', 'OtherLabelTest', 'AghanimRelationshipTest']
        })
        await aghanim.save(data)
        done()
      })()
    })

    afterEach((done) => {
      (async () => {
        await aghanim.remove({
          label: ['AghanimTest', 'OtherLabelTest', 'AghanimRelationshipTest']
        })
        done()
      })()
    })

    it('label', (done) => {
      (async () => {
        let result = await aghanim.findByQueryObject({
          label: 'OtherLabelTest'
        })
        expect(result).to.be.an('array').that.have.lengthOf(1)
        expect(result[0]).to.have.property('_label', 'OtherLabelTest')
        expect(result[0]).to.have.property('uuid')
        done()
      })()
    })

    it('multiple labels', (done) => {
      (async () => {
        let result = await aghanim.findByQueryObject({
          label: ['OtherLabelTest', 'AghanimTest']
        })
        expect(result).to.be.an('array').that.have.lengthOf(data.length)
        expect(result).all.have.property('_label')
        expect(result).all.have.property('uuid')
        done()
      })()
    })

    it('order', (done) => {
      (async () => {
        let result = await aghanim.findByQueryObject({
          label: 'AghanimTest',
          order: (n) => n.name
        })

        expect(result).to.be.an('array').that.have.lengthOf(aghanimTestLength)
        expect(result[0]).to.have.property('name', '0name1$')
        expect(result[1]).to.have.property('name', '0name2$')
        expect(result[2]).to.have.property('name', '0name3$')
        done()
      })()
    })

    it('limit', (done) => {
      (async () => {
        let result = await aghanim.findByQueryObject({
          label: 'AghanimTest',
          order: n => n.name,
          limit: 3
        })
        expect(result).to.be.an('array').that.have.lengthOf(3)
        expect(result[0]).to.have.property('name', '0name1$')
        expect(result[1]).to.have.property('name', '0name2$')
        expect(result[2]).to.have.property('name', '0name3$')
        done()
      })()
    })

    it('skip', (done) => {
      (async () => {
        let result = await aghanim.findByQueryObject({
          label: 'AghanimTest',
          order: n => n.name,
          skip: 2
        })
        expect(result).to.be.an('array').that.have.lengthOf(aghanimTestLength - 2)
        expect(result[0]).to.have.property('name', '0name3$')
        done()
      })()
    })

    it('paginate', (done) => {
      (async () => {
        let result = await aghanim.findByQueryObject({
          label: 'AghanimTest',
          order: n => n.name,
          skip: 2,
          limit: 2
        })
        expect(result).to.be.an('array').that.have.lengthOf(2)
        expect(result[0]).to.have.property('name', '0name3$')
        done()
      })()
    })

    // it('custom identifier', (done) => {
    //   (async () => {
    //     let result = await aghanim.findByQueryObject({
    //       label: 'OtherLabelTest',
    //       identifier: 'custom',
    //       where: 'property = custom.property'
    //     })
    //   })()
    //
    //   }, (err, result) => {
    //     if (err) done(err)
    //     expect(result).to.be.an('array').that.have.lengthOf(1)
    //     expect(result).all.have.property('_label')
    //     expect(result).all.have.property('uuid')
    //     expect(result).all.have.property('property', 'value')
    //     done()
    //   })
    // })

    it('mandatory relationship', (done) => {
      (async () => {
        let result = await aghanim.findByQueryObject({
          label: 'AghanimTest',
          include: [{
            name: 'skills',
            mandatory: true
          }]
        })
        console.log(result)
        expect(result).to.be.an('array').that.have.lengthOf(2)
        expect(result).all.have.property('skills').that.is.an('array')
        done()
      })()
    })

    it('include', (done) => {
      (async () => {
        let result = await aghanim.findByQueryObject({
          label: 'AghanimTest',
          include: [{
            name: 'skills'
          }]
        })
        expect(result).to.be.an('array').that.have.lengthOf(aghanimTestLength)
        expect(_.filter(result, 'skills')).to.be.an('array').that.have.lengthOf(2)
        expect(_.filter(result, 'skills')).all.to.not.have.property('lore')
        expect(result).all.to.have.property('uuid')
        expect(result).all.to.have.property('_label', 'AghanimTest')
        done()
      })()
    })

    it('order include', (done) => {
      (async () => {
        let result = await aghanim.findByQueryObject({
          label: 'AghanimTest',
          order: n => n.name,
          include: [{
            name: 'skills',
            order: n => n.title,
            mandatory: true
          }]
        })
        expect(result).to.be.an('array').that.have.lengthOf(2)
        expect(result).all.to.not.have.property('lore')
        expect(result).all.to.have.property('uuid')
        expect(result).all.to.have.property('_label', 'AghanimTest')
        expect(_.map(result[0].skills, 'title')).to.be.deep.equal(_.chain(crystalMaiden.skills)
                                                                   .sortBy('title')
                                                                   .map('title')
                                                                   .value())
        expect(_.map(result[1].skills, 'title')).to.be.deep.equal(_.chain(sven.skills)
                                                                   .sortBy('title')
                                                                   .map('title')
                                                                   .value())
        done()
      })()
    })

    it('paginate include', (done) => {
      (async () => {
        let result = await aghanim.findByQueryObject({
          label: 'AghanimTest',
          order: n => n.name,
          include: [{
            name: 'skills',
            order: n => n.title,
            mandatory: true,
            skip: 1,
            limit: 2
          }]
        })
        expect(result).to.be.an('array').that.have.lengthOf(2)
        expect(result).all.to.not.have.property('lore')
        expect(result).all.to.have.property('uuid')
        expect(result).all.to.have.property('_label', 'AghanimTest')
        expect(_.map(result[0].skills, 'title')).to.be.deep.equal(_.chain(crystalMaiden.skills)
                                                                   .sortBy('title')
                                                                   .map('title')
                                                                   .value()
                                                                   .slice().splice(1, 2))
        expect(_.map(result[1].skills, 'title')).to.be.deep.equal(_.chain(sven.skills)
                                                                   .sortBy('title')
                                                                   .map('title')
                                                                   .value()
                                                                   .slice().splice(1, 2))
        done()
      })()
    })

    it('where string equals', (done) => {
      (async () => {
        let result = await aghanim.findByQueryObject({
          label: 'AghanimTest',
          where: (n, args) => n.name === args.string,
          args: {
            string: '0name1$'
          }
        })
        expect(result).to.be.an('array').that.have.lengthOf(1)
        expect(result[0]).to.have.property('uuid')
        expect(result[0]).to.have.property('name', '0name1$')
        done()
      })()
    })

    it('where string contains', (done) => {
      (async () => {
        let result = await aghanim.findByQueryObject({
          label: 'AghanimTest',
          where: (n, args) => n.name.includes(args.name),
          args: {
            name: 'name'
          }
        })
        expect(result).to.be.an('array').that.have.lengthOf(3)
        expect(result).all.to.have.property('uuid')
        expect(result).all.to.have.property('name')
        done()
      })()
    })

    it('where string starts with', (done) => {
      (async () => {
        let result = await aghanim.findByQueryObject({
          label: 'AghanimTest',
          where: (n, args) => n.name.startsWith(args.number),
          args: {
            number: '0'
          }
        })
        expect(result).to.be.an('array').that.have.lengthOf(3)
        expect(result).all.to.have.property('uuid')
        expect(result).all.to.have.property('name')
        done()
      })()
    })

    it('where string ends with', (done) => {
      (async () => {
        let result = await aghanim.findByQueryObject({
          label: 'AghanimTest',
          where: (n, args) => n.name.endsWith(args.string),
          args: {
            string: '$'
          }
        })
        expect(result).to.be.an('array').that.have.lengthOf(3)
        expect(result).all.to.have.property('uuid')
        expect(result).all.to.have.property('name')
        done()
      })()
    })

    it('where number greater than', (done) => {
      (async () => {
        let result = await aghanim.findByQueryObject({
          label: 'AghanimTest',
          where: (n, args) => n.number > args.number,
          args: {
            number: 10
          }
        })
        expect(result).to.be.an('array').that.have.lengthOf(2)
        expect(result).all.to.have.property('uuid')
        expect(result).all.to.have.property('number')
        done()
      })()
    })

    it('where number lesser than', (done) => {
      (async () => {
        let result = await aghanim.findByQueryObject({
          label: 'AghanimTest',
          where: (n, args) => n.number < args.number,
          args: {
            number: 20
          }
        })
        expect(result).to.be.an('array').that.have.lengthOf(2)
        expect(result).all.to.have.property('uuid')
        expect(result).all.to.have.property('number')
        done()
      })()
    })

    it('where number equals or greater than', (done) => {
      (async () => {
        let result = await aghanim.findByQueryObject({
          label: 'AghanimTest',
          where: (n, args) => n.number >= args.number,
          args: {
            number: 10
          }
        })
        expect(result).to.be.an('array').that.have.lengthOf(3)
        expect(result).all.to.have.property('uuid')
        expect(result).all.to.have.property('number')
        done()
      })()
    })

    it('where number equals or lesser than', (done) => {
      (async () => {
        let result = await aghanim.findByQueryObject({
          label: 'AghanimTest',
          where: (n, args) => n.number <= args.number,
          args: {
            number: 20
          }
        })
        expect(result).to.be.an('array').that.have.lengthOf(3)
        expect(result).all.to.have.property('uuid')
        expect(result).all.to.have.property('number')
        done()
      })()
    })

    it('where boolean', (done) => {
      (async () => {
        let result = await aghanim.findByQueryObject({
          label: 'AghanimTest',
          where: (n, args) => n.boolean === args.value,
          args: {
            value: true
          }
        })
        expect(result).to.be.an('array').that.have.lengthOf(1)
        expect(result).all.to.have.property('uuid')
        expect(result).all.to.have.property('boolean')
        done()
      })()
    })

    it('where boolean', (done) => {
      (async () => {
        let result = await aghanim.findByQueryObject({
          label: 'AghanimTest',
          where: (n, args) => n.boolean === args.value,
          args: {
            value: false
          }
        })
        expect(result).to.be.an('array').that.have.lengthOf(1)
        expect(result).all.to.have.property('uuid')
        expect(result).all.to.have.property('boolean')
        done()
      })()
    })

    it('chain where', (done) => {
      (async () => {
        let result = await aghanim.findByQueryObject({
          label: 'AghanimTest',
          where: (n, args) => n.boolean == args.value || n.number <= args.number || n.name.includes(args.string),
          args: {
            value: true,
            number: 20,
            string: 'na'
          }
        })
        expect(result).to.be.an('array').that.have.lengthOf(7)
        expect(result).all.to.have.property('uuid')
        done()
      })()
    })

    it('where include', (done) => {
      (async () => {
        let result = await aghanim.findByQueryObject({
          label: 'AghanimTest',
          include: [{
            name: 'skills',
            where: (n, args) => n.title.includes(args.string),
            args: {
              string: 'Nova'
            },
            mandatory: true
          }]
        })
        expect(result).to.be.an('array').that.have.lengthOf(1)
        expect(result).all.to.have.property('skills')
        expect(_.flatMap(result, 'skills')).to.include.something.with.property('title', 'Crystal Nova')
        expect(result).all.to.have.property('uuid')
        done()
      })()
    })

    it('include of include', (done) => {
      (async () => {
        let result = await aghanim.findByQueryObject({
          label: 'AghanimTest',
          include: [{
            name: 'skills',
            mandatory: true,
            include: [{
              name: 'lore',
              mandatory: true
            }]
          }]
        })
        console.log(result)
        expect(result).to.be.an('array').that.have.lengthOf(1)
        expect(result[0]).to.have.property('skills').that.is.an('array')
        expect(result).all.to.have.property('uuid')
        expect(_.flatMap(result, 'skills')).to.include.something.with.property('lore')
        done()
      })()
    })
  })
})
