'use strict';
const {sequelize, DataTypes} = require('./sequelize-loader');

const User = sequelize.define(
  'users',
  {
    userId: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false
    },
    username: {
      type: DataTypes.STRING, //グーグルアカウントのidは桁が大きいためstring型に変更
      allowNull: false
    }
  },
   {
    freezeTableName: true,
    timestamps: false
  }
);

module.exports = User;