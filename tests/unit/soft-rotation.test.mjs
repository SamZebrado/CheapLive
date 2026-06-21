import { describe, it } from 'node:test';
import assert from 'node:assert';
import { deformSpindle, createSpindleMesh } from '../../src/face-tracking/mesh-spindle-whale.js';

describe('soft rotation bend profile', () => {
  it('bendProfile is monotonic increasing from 0 to 1', () => {
    function bendProfile(s) {
      const t = Math.max(0, Math.min(1, s));
      return t * t * (3 - 2 * t);
    }
    
    assert.strictEqual(bendProfile(0), 0);
    assert.strictEqual(bendProfile(1), 1);
    
    for (let i = 0; i < 10; i++) {
      const s1 = i / 10;
      const s2 = (i + 1) / 10;
      assert.ok(bendProfile(s2) >= bendProfile(s1), 
        `bendProfile(${s2}) should be >= bendProfile(${s1})`);
    }
  });

  it('effectiveYaw decreases from head to tail', () => {
    const mesh = createSpindleMesh({ resolution: 64 });
    const params = { angleY: 45, angleX: 30 };
    const deformed = deformSpindle(mesh, params);
    
    let headVertex = null;
    let tailVertex = null;
    
    for (const v of deformed.vertices) {
      if (v.t !== undefined) {
        if (headVertex === null || v.t < headVertex.t) {
          headVertex = v;
        }
        if (tailVertex === null || v.t > tailVertex.t) {
          tailVertex = v;
        }
      }
    }
    
    assert.ok(headVertex !== null, 'head vertex found');
    assert.ok(tailVertex !== null, 'tail vertex found');
    assert.ok(headVertex.t < tailVertex.t, 'head t < tail t');
  });

  it('deformSpindle produces different transformed positions for head vs tail at 45deg yaw', () => {
    const mesh = createSpindleMesh({ resolution: 64 });
    const params = { angleY: 45 };
    const deformed = deformSpindle(mesh, params);
    
    let headTx = null;
    let tailTx = null;
    
    for (const v of deformed.vertices) {
      if (v.t !== undefined) {
        if (headTx === null || v.t < 0.1) {
          headTx = v.tx;
        }
        if (tailTx === null || v.t > 0.9) {
          tailTx = v.tx;
        }
      }
    }
    
    assert.ok(headTx !== null, 'head transformed x found');
    assert.ok(tailTx !== null, 'tail transformed x found');
    assert.ok(Math.abs(headTx - tailTx) > 0.01, 
      'head and tail should have different transformed positions');
  });

  it('deformSpindle with zero angles leaves mesh unchanged', () => {
    const mesh = createSpindleMesh({ resolution: 32 });
    const params = { angleY: 0, angleX: 0, angleZ: 0 };
    const deformed = deformSpindle(mesh, params);
    
    for (let i = 0; i < mesh.vertices.length; i++) {
      const orig = mesh.vertices[i];
      const def = deformed.vertices[i];
      assert.ok(Math.abs(orig.x - def.tx) < 0.0001, 'x unchanged');
      assert.ok(Math.abs(orig.y - def.ty) < 0.0001, 'y unchanged');
      assert.ok(Math.abs(orig.z - def.tz) < 0.0001, 'z unchanged');
    }
  });
});