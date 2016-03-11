'use strict';
let loader = require('./sequelize-loader');
let Sequelize = loader.Sequelize;

let Candidate = loader.database.define('candidates', {
  candidateId: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  candidateName: {
    type: Sequelize.STRING,
    allowNull: false
  },
  scheduleId: {
    type: Sequelize.UUID,
    allowNull: false
  }
}, {
    freezeTableName: true,
    timestamps: false,
    indexes: [
      {
        fields: ['scheduleId']
      }
    ]
  });

module.exports = Candidate;
