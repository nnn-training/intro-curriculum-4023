'use strict';
let Sequelize = require('sequelize');
let sequelize = new Sequelize(
  process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost/schedule_arranger',
  { logging: true });

module.exports = {
  database: sequelize,
  Sequelize: Sequelize
};