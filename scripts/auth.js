const SUPERVISORS = {
    boss: { password: "boss", name: "Гуляев Денис Михайлович" },
    ink: { password: "ink", name: "Декин Александр Юрьевич" },
  };
  
  const MASTERS = Object.fromEntries(
    Array.from({ length: 30 }, (_, i) => {
      const bb = i + 1;
      return [`m${bb}`, { password: String(bb), bb, name: `Мастер ББ ${bb}` }];
    }),
  );
  
  function authenticateUser(username, password) {
    const sup = SUPERVISORS[username];
    if (sup && sup.password === password) {
      return { role: "supervisor", name: sup.name || username };
    }
  
    const m = MASTERS[username];
    if (m && m.password === password) {
      return { role: "master", bb: m.bb, name: m.name || username };
    }
  
    return null;
  }