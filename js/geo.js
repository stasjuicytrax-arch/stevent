// Проекция и геометрия для точечной карты России — docs/05-REVISION-02.md, R15.
// Чистые функции без DOM, изоляция через IIFE (без import/export — file://).
(function () {
  'use strict';

  // Albers Equal Area Conic — стандартная проекция для России.
  // Стандартные параллели 52°/64°, центральный меридиан 100°E (буквально
  // из R15). Опорная широта ложного начала координат (origin latitude)
  // выбрана 62° — примерный центр широтного диапазона страны; влияет
  // только на смещение (ρ0), не на форму, т.к. результат дальше линейно
  // масштабируется под canvas в js/map.js.
  var DEG = Math.PI / 180;
  var PHI1 = 52 * DEG;
  var PHI2 = 64 * DEG;
  var PHI0 = 62 * DEG;
  var LAMBDA0 = 100 * DEG;

  var SIN_N = (Math.sin(PHI1) + Math.sin(PHI2)) / 2;
  var C = Math.cos(PHI1) * Math.cos(PHI1) + 2 * SIN_N * Math.sin(PHI1);
  var RHO0 = Math.sqrt(C - 2 * SIN_N * Math.sin(PHI0)) / SIN_N;

  // Долготы восточной Чукотки в этом наборе данных хранятся отрицательными
  // (GeoJSON режет полигоны по антимеридиану): -180…-169.9. У России нет
  // территории между -150° и 0°, поэтому правило безопасно применять
  // к каждой точке отдельно, без анализа полигона целиком.
  function normalizeLon(lon) {
    return lon < -150 ? lon + 360 : lon;
  }

  // lon/lat в градусах → {x, y} в условных единицах проекции (R=1)
  function project(lon, lat) {
    var lambda = normalizeLon(lon) * DEG;
    var phi = lat * DEG;
    var theta = SIN_N * (lambda - LAMBDA0);
    var rho = Math.sqrt(C - 2 * SIN_N * Math.sin(phi)) / SIN_N;
    return {
      x: rho * Math.sin(theta),
      y: RHO0 - rho * Math.cos(theta),
    };
  }

  // Точка в кольце полигона — алгоритм ray casting (чётно-нечетное правило)
  function pointInRing(x, y, ring) {
    var inside = false;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      var xi = ring[i][0], yi = ring[i][1];
      var xj = ring[j][0], yj = ring[j][1];
      var intersect = (yi > y) !== (yj > y) &&
        x < (xj - xi) * (y - yi) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  // MultiPolygon (в уже спроецированных координатах) — попадание в любой
  // из полигонов при непопадании ни в одну из его внутренних дыр
  function pointInMultiPolygon(x, y, polygons) {
    for (var p = 0; p < polygons.length; p++) {
      var rings = polygons[p];
      if (!pointInRing(x, y, rings[0])) continue;
      var inHole = false;
      for (var r = 1; r < rings.length; r++) {
        if (pointInRing(x, y, rings[r])) { inHole = true; break; }
      }
      if (!inHole) return true;
    }
    return false;
  }

  window.ST_GEO = {
    project: project,
    normalizeLon: normalizeLon,
    pointInMultiPolygon: pointInMultiPolygon,
  };
})();
