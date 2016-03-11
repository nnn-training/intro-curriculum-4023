'use strict';
let loader = require('./sequelize-loader');
let Sequelize = loader.Sequelize;

let Availability = loader.database.define('availabilities', {
  candidateId: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    allowNull: false
  },
  userId: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    allowNull: false
  },
  availability: {
    type: Sequelize.INTEGER,
    allowNull: false,
    defaultValue: 0
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

module.exports = Availability;
