// ── Inventario completo de universidades argentinas ───────────────────────
// Fuente: Inventario de Universidades Argentinas.md
// Tipo: 'nacional' | 'privada' | 'provincial' | 'instituto'

export const UNIVERSITIES = [

  // ════════════════════════════════════════════
  // NACIONALES
  // ════════════════════════════════════════════
  { id: 'uba',      name: 'UBA',      full: 'Universidad de Buenos Aires',                                        province: 'CABA',            type: 'nacional',  color: '#23355C', logo: '/logos/uba.svg'         },
  { id: 'unc',      name: 'UNC',      full: 'Universidad Nacional de Córdoba',                                     province: 'Córdoba',         type: 'nacional',  color: '#2D5FA3', logo: '/logos/unc.webp'          },
  { id: 'unlp',     name: 'UNLP',     full: 'Universidad Nacional de La Plata',                                    province: 'Buenos Aires',    type: 'nacional',  color: '#003087', logo: '/logos/unlp.svg'         },
  { id: 'unl',      name: 'UNL',      full: 'Universidad Nacional del Litoral',                                    province: 'Santa Fe',        type: 'nacional',  color: '#005B9A', logo: '/logos/unl.svg'          },
  { id: 'utn',      name: 'UTN',      full: 'Universidad Tecnológica Nacional',                                    province: 'CABA',            type: 'nacional',  color: '#C8102E', logo: '/logos/utn.webp'          },
  { id: 'unr',      name: 'UNR',      full: 'Universidad Nacional de Rosario',                                     province: 'Santa Fe',        type: 'nacional',  color: '#005B5E', logo: '/logos/unr.webp'          },
  { id: 'unt',      name: 'UNT',      full: 'Universidad Nacional de Tucumán',                                     province: 'Tucumán',         type: 'nacional',  color: '#1A5C38', logo: '/logos/unt_dark.webp'          },
  { id: 'uncuyo',   name: 'UNCuyo',   full: 'Universidad Nacional de Cuyo',                                        province: 'Mendoza',         type: 'nacional',  color: '#6B2D8B', logo: '/logos/uncuyo.webp'       },
  { id: 'uns',      name: 'UNS',      full: 'Universidad Nacional del Sur',                                        province: 'Buenos Aires',    type: 'nacional',  color: '#1B4B8A', logo: '/logos/uns.svg'          },
  { id: 'unne',     name: 'UNNE',     full: 'Universidad Nacional del Nordeste',                                   province: 'Corrientes',      type: 'nacional',  color: '#1B6CA8', logo: '/logos/unne_v3.webp'     },
  { id: 'unmdp',    name: 'UNMdP',    full: 'Universidad Nacional de Mar del Plata',                               province: 'Buenos Aires',    type: 'nacional',  color: '#004B87', logo: '/logos/unmdp.svg'        },
  { id: 'unsa',     name: 'UNSa',     full: 'Universidad Nacional de Salta',                                       province: 'Salta',           type: 'nacional',  color: '#8B0000', logo: '/logos/unsa.webp'         },
  { id: 'unsj',     name: 'UNSJ',     full: 'Universidad Nacional de San Juan',                                    province: 'San Juan',        type: 'nacional',  color: '#5C3317', logo: '/logos/unsj_footer.webp'  },
  { id: 'unsl',     name: 'UNSL',     full: 'Universidad Nacional de San Luis',                                    province: 'San Luis',        type: 'nacional',  color: '#4A6B8A', logo: '/logos/unsl.svg'         },
  { id: 'unse',     name: 'UNSE',     full: 'Universidad Nacional de Santiago del Estero',                         province: 'Santiago del Estero', type: 'nacional', color: '#7B4F2E', logo: '/logos/unse.svg'    },
  { id: 'unco',     name: 'UNCo',     full: 'Universidad Nacional del Comahue',                                    province: 'Neuquén',         type: 'nacional',  color: '#2E6B5E', logo: '/logos/unco.webp'         },
  { id: 'unpsjb',   name: 'UNPSJB',   full: 'Universidad Nacional de la Patagonia San Juan Bosco',                province: 'Chubut',          type: 'nacional',  color: '#2C4A7C', logo: '/logos/unpsjb.webp'       },
  { id: 'unlz',     name: 'UNLZ',     full: 'Universidad Nacional de Lomas de Zamora',                             province: 'Buenos Aires',    type: 'nacional',  color: '#3B5B8C', logo: '/logos/unlz.webp'         },
  { id: 'unlu',     name: 'UNLu',     full: 'Universidad Nacional de Luján',                                       province: 'Buenos Aires',    type: 'nacional',  color: '#1D5C7B', logo: '/logos/unlu.svg'         },
  { id: 'unam_m',   name: 'UNaM',     full: 'Universidad Nacional de Misiones',                                    province: 'Misiones',        type: 'nacional',  color: '#4B7A3B', logo: '/logos/unam.svg'         },
  { id: 'uner',     name: 'UNER',     full: 'Universidad Nacional de Entre Ríos',                                  province: 'Entre Ríos',      type: 'nacional',  color: '#2D6A6A', logo: '/logos/uner.svg'         },
  { id: 'unca',     name: 'UNCA',     full: 'Universidad Nacional de Catamarca',                                   province: 'Catamarca',       type: 'nacional',  color: '#6B3B2E', logo: '/logos/unca.svg'         },
  { id: 'unju',     name: 'UNJu',     full: 'Universidad Nacional de Jujuy',                                       province: 'Jujuy',           type: 'nacional',  color: '#4A7A3E', logo: '/logos/unju.svg'         },
  { id: 'unrc',     name: 'UNRC',     full: 'Universidad Nacional de Río Cuarto',                                  province: 'Córdoba',         type: 'nacional',  color: '#2D5FA3', logo: '/logos/unrc.svg'         },
  { id: 'unicen',   name: 'UNICEN',   full: 'Universidad Nacional del Centro de la Prov. de Buenos Aires',        province: 'Buenos Aires',    type: 'nacional',  color: '#1B4B6B', logo: '/logos/unicen.svg'       },
  { id: 'unf',      name: 'UNF',      full: 'Universidad Nacional de Formosa',                                     province: 'Formosa',         type: 'nacional',  color: '#3B6B3B', logo: '/logos/unf.svg'          },
  { id: 'unsam',    name: 'UNSAM',    full: 'Universidad Nacional de General San Martín',                          province: 'Buenos Aires',    type: 'nacional',  color: '#1A3F6B', logo: '/logos/unsam.svg'        },
  { id: 'ungs',     name: 'UNGS',     full: 'Universidad Nacional de General Sarmiento',                           province: 'Buenos Aires',    type: 'nacional',  color: '#2B5A8A', logo: '/logos/ungs.webp'         },
  { id: 'unlam',    name: 'UNLaM',    full: 'Universidad Nacional de La Matanza',                                  province: 'Buenos Aires',    type: 'nacional',  color: '#2C6B2F', logo: '/logos/unlam.webp'        },
  { id: 'unla',     name: 'UNLa',     full: 'Universidad Nacional de Lanús',                                       province: 'Buenos Aires',    type: 'nacional',  color: '#1E5B6B', logo: '/logos/unla.webp'         },
  { id: 'unq',      name: 'UNQ',      full: 'Universidad Nacional de Quilmes',                                     province: 'Buenos Aires',    type: 'nacional',  color: '#23355C', logo: '/logos/unq.webp'          },
  { id: 'untref',   name: 'UNTREF',   full: 'Universidad Nacional de Tres de Febrero',                             province: 'Buenos Aires',    type: 'nacional',  color: '#3B2D8B', logo: '/logos/untref.webp'       },
  { id: 'unlpam',   name: 'UNLPam',   full: 'Universidad Nacional de La Pampa',                                    province: 'La Pampa',        type: 'nacional',  color: '#5B3D1A', logo: '/logos/unlpam.svg'       },
  { id: 'unpa',     name: 'UNPA',     full: 'Universidad Nacional de la Patagonia Austral',                        province: 'Santa Cruz',      type: 'nacional',  color: '#2B4F6B', logo: '/logos/unpa.svg'         },
  { id: 'unlar',    name: 'UNLaR',    full: 'Universidad Nacional de La Rioja',                                    province: 'La Rioja',        type: 'nacional',  color: '#7B2D1A', logo: '/logos/unlar.svg'        },
  { id: 'unvm',     name: 'UNVM',     full: 'Universidad Nacional de Villa María',                                  province: 'Córdoba',         type: 'nacional',  color: '#1A5B4B', logo: '/logos/unvm.svg'         },
  { id: 'undec',    name: 'UNDEC',    full: 'Universidad Nacional de Chilecito',                                   province: 'La Rioja',        type: 'nacional',  color: '#5B4A1A', logo: '/logos/undec.webp'                       },
  { id: 'unnoba',   name: 'UNNOBA',   full: 'Universidad Nacional del Noroeste de la Prov. de Buenos Aires',      province: 'Buenos Aires',    type: 'nacional',  color: '#2B5B7B', logo: '/logos/unnoba.svg'       },
  { id: 'unrn',     name: 'UNRN',     full: 'Universidad Nacional de Río Negro',                                   province: 'Río Negro',       type: 'nacional',  color: '#1A4B6B', logo: '/logos/unrn.svg'         },
  { id: 'uncaus',   name: 'UNCAUS',   full: 'Universidad Nacional del Chaco Austral',                              province: 'Chaco',           type: 'nacional',  color: '#3B5B2B', logo: '/logos/uncaus.webp'                       },
  { id: 'undav',    name: 'UNDAV',    full: 'Universidad Nacional de Avellaneda',                                  province: 'Buenos Aires',    type: 'nacional',  color: '#2B4B8B', logo: '/logos/undav.svg'        },
  { id: 'unm',      name: 'UNM',      full: 'Universidad Nacional de Moreno',                                      province: 'Buenos Aires',    type: 'nacional',  color: '#4B2D7B', logo: '/logos/unm.svg'          },
  { id: 'uno',      name: 'UNO',      full: 'Universidad Nacional del Oeste',                                      province: 'Buenos Aires',    type: 'nacional',  color: '#1B5B4B', logo: '/logos/uno.webp'                       },
  { id: 'untdf',    name: 'UNTDF',    full: 'Univ. Nacional de Tierra del Fuego, Antártida e Islas del Atlántico Sur', province: 'Tierra del Fuego', type: 'nacional', color: '#1A3A5B', logo: '/logos/untdf.svg'  },
  { id: 'unpaz',    name: 'UNPAZ',    full: 'Universidad Nacional de José Clemente Paz',                           province: 'Buenos Aires',    type: 'nacional',  color: '#2B6B4B', logo: '/logos/unpaz.webp'                       },
  { id: 'unaj',     name: 'UNAJ',     full: 'Universidad Nacional Arturo Jauretche',                               province: 'Buenos Aires',    type: 'nacional',  color: '#4B2B5B', logo: '/logos/unaj.webp'         },
  { id: 'unahur',   name: 'UNAHUR',   full: 'Universidad Nacional de Hurlingham',                                  province: 'Buenos Aires',    type: 'nacional',  color: '#1B4B7B', logo: '/logos/unahur.webp'       },
  { id: 'unau',     name: 'UNAU',     full: 'Universidad Nacional del Alto Uruguay',                               province: 'Misiones',        type: 'nacional',  color: '#3B6B2B', logo: '/logos/unau.webp'                       },
  { id: 'unraf',    name: 'UNRaf',    full: 'Universidad Nacional de Rafaela',                                     province: 'Santa Fe',        type: 'nacional',  color: '#2B5B6B', logo: '/logos/unraf.webp'                       },
  { id: 'unsada',   name: 'UNSAdA',   full: 'Universidad Nacional de San Antonio de Areco',                       province: 'Buenos Aires',    type: 'nacional',  color: '#4B3B1A', logo: '/logos/unsada.webp'                       },
  { id: 'unlc',     name: 'UNLC',     full: 'Universidad Nacional de los Comechingones',                           province: 'San Luis',        type: 'nacional',  color: '#5B3B2B', logo: '/logos/unlc.webp'                       },
  { id: 'unab',     name: 'UNaB',     full: 'Universidad Nacional Guillermo Brown',                                province: 'Buenos Aires',    type: 'nacional',  color: '#1A3B5B', logo: '/logos/unab.webp'                       },
  { id: 'undelta',  name: 'UNDelta',  full: 'Universidad Nacional del Delta',                                      province: 'Buenos Aires',    type: 'nacional',  color: '#1B5A4A', logo: '/logos/undelta.svg'                       },
  { id: 'unp',      name: 'UNP',      full: 'Universidad Nacional de Pilar',                                       province: 'Buenos Aires',    type: 'nacional',  color: '#3A4B7A', logo: '/logos/unp.webp'                       },
  { id: 'unrt',     name: 'UNRT',     full: 'Universidad Nacional de Río Tercero',                                 province: 'Córdoba',         type: 'nacional',  color: '#2D5FA3', logo: '/logos/unrt.svg'                       },
  { id: 'une', name: 'UNE', full: 'Universidad Nacional de Ezeiza', province: 'Buenos Aires', type: 'nacional', color: '#1A4B5B', logo: '/logos/une.svg' },
  { id: 'una_artes',name: 'UNA',      full: 'Universidad Nacional de las Artes',                                   province: 'CABA',            type: 'nacional',  color: '#6B1A4B', logo: '/logos/una.svg'          },

  // ════════════════════════════════════════════
  // PROVINCIALES
  // ════════════════════════════════════════════
  { id: 'unicaba',  name: 'UniCABA',  full: 'Universidad de la Ciudad de Buenos Aires',                           province: 'CABA',            type: 'provincial', color: '#2B3B6B', logo: '/logos/unicaba.webp'                      },
  { id: 'uader',    name: 'UADER',    full: 'Universidad Autónoma de Entre Ríos',                                  province: 'Entre Ríos',      type: 'provincial', color: '#2B6B5B', logo: '/logos/uader.webp'                      },
  { id: 'upc',      name: 'UPC',      full: 'Universidad Provincial de Córdoba',                                   province: 'Córdoba',         type: 'provincial', color: '#2D5FA3', logo: '/logos/upc.webp'                      },
  { id: 'udc',      name: 'UDC',      full: 'Universidad del Chubut',                                              province: 'Chubut',          type: 'provincial', color: '#2B4B6B', logo: '/logos/udc.webp'                      },
  { id: 'ulp',      name: 'ULP',      full: 'Universidad de La Punta',                                             province: 'San Luis',        type: 'provincial', color: '#3B6B2B', logo: '/logos/ulp.svg'                      },
  { id: 'upro',     name: 'UPrO',     full: 'Universidad Provincial de Oficios Eva Perón',                        province: 'San Luis',        type: 'provincial', color: '#4B2B5B', logo: '/logos/upro.webp'                      },
  { id: 'upe',      name: 'UPE',      full: 'Universidad Provincial de Ezeiza',                                    province: 'Buenos Aires',    type: 'provincial', color: '#1B4B6B', logo: '/logos/upe.webp'                      },
  { id: 'upso',     name: 'UPSO',     full: 'Universidad Provincial del Sudoeste',                                 province: 'Buenos Aires',    type: 'provincial', color: '#1A4B5B', logo: '/logos/upso.webp'                      },
  { id: 'upateco',  name: 'UPATecO',  full: 'Univ. Provincial de Administración, Tecnología y Oficios',           province: 'Salta',           type: 'provincial', color: '#6B2B1A', logo: '/logos/upateco.webp'                      },

  // ════════════════════════════════════════════
  // PRIVADAS
  // ════════════════════════════════════════════
  { id: 'itba',     name: 'ITBA',     full: 'Instituto Tecnológico de Buenos Aires',                               province: 'CABA',            type: 'privada',   color: '#1A3B5B', logo: '/logos/itba.webp'         },
  { id: 'uai',      name: 'UAI',      full: 'Universidad Abierta Interamericana',                                  province: 'CABA',            type: 'privada',   color: '#8B1A1A', logo: '/logos/uai.svg'          },
  { id: 'uap',      name: 'UAP',      full: 'Universidad Adventista del Plata',                                    province: 'Entre Ríos',      type: 'privada',   color: '#1A5B3B', logo: '/logos/uap.webp'                       },
  { id: 'uade',     name: 'UADE',     full: 'Universidad Argentina de la Empresa',                                 province: 'CABA',            type: 'privada',   color: '#1A1A6B', logo: '/logos/uade.svg'         },
  { id: 'uk',       name: 'UK',       full: 'Universidad Argentina John F. Kennedy',                               province: 'CABA',            type: 'privada',   color: '#1A3B6B', logo: '/logos/uk.webp'                       },
  { id: 'uaa',      name: 'UAA',      full: 'Universidad Atlántida Argentina',                                     province: 'Buenos Aires',    type: 'privada',   color: '#1A5B6B', logo: '/logos/uaa.webp'                       },
  { id: 'ua',       name: 'UA',       full: 'Universidad Austral',                                                 province: 'CABA',            type: 'privada',   color: '#1A2B4B', logo: '/logos/ua.svg'           },
  { id: 'ubp',      name: 'UBP',      full: 'Universidad Blas Pascal',                                             province: 'Córdoba',         type: 'privada',   color: '#2B5FA3', logo: '/logos/ubp.webp'                       },
  { id: 'ucaece',   name: 'UCAECE',   full: 'Universidad CAECE',                                                   province: 'CABA',            type: 'privada',   color: '#3B1A5B', logo: '/logos/ucaece.webp'                       },
  { id: 'uca',      name: 'UCA',      full: 'Pontificia Universidad Católica Argentina',                           province: 'CABA',            type: 'privada',   color: '#7B1A1A', logo: '/logos/uca.svg'          },
  { id: 'ucc',      name: 'UCC',      full: 'Universidad Católica de Córdoba',                                     province: 'Córdoba',         type: 'privada',   color: '#7B2B1A', logo: '/logos/ucc.svg'          },
  { id: 'uccuyo',   name: 'UCCuyo',   full: 'Universidad Católica de Cuyo',                                        province: 'San Juan',        type: 'privada',   color: '#5B1A3B', logo: '/logos/uccuyo.webp'                       },
  { id: 'ucalp',    name: 'UCALP',    full: 'Universidad Católica de La Plata',                                    province: 'Buenos Aires',    type: 'privada',   color: '#6B1A2B', logo: '/logos/ucalp.webp'                       },
  { id: 'ucami',    name: 'UCAMI',    full: 'Universidad Católica de las Misiones',                                province: 'Misiones',        type: 'privada',   color: '#3B5B1A', logo: '/logos/ucami.webp'                       },
  { id: 'ucasal',   name: 'UCASAL',   full: 'Universidad Católica de Salta',                                       province: 'Salta',           type: 'privada',   color: '#6B2B1A', logo: '/logos/ucasal.svg'       },
  { id: 'ucsf',     name: 'UCSF',     full: 'Universidad Católica de Santa Fe',                                    province: 'Santa Fe',        type: 'privada',   color: '#5B1A1A', logo: '/logos/ucsf.webp'                       },
  { id: 'ucse',     name: 'UCSE',     full: 'Universidad Católica de Santiago del Estero',                         province: 'Santiago del Estero', type: 'privada', color: '#6B3B1A', logo: '/logos/ucse.webp'                   },
  { id: 'ub',       name: 'UB',       full: 'Universidad de Belgrano',                                             province: 'CABA',            type: 'privada',   color: '#1A3B7B', logo: '/logos/ub.svg'           },
  { id: 'uces',     name: 'UCES',     full: 'Universidad de Ciencias Empresariales y Sociales',                   province: 'CABA',            type: 'privada',   color: '#2B4B6B', logo: '/logos/uces.svg'         },
  { id: 'ucu',      name: 'UCU',      full: 'Universidad de Concepción del Uruguay',                               province: 'Entre Ríos',      type: 'privada',   color: '#1A5B4B', logo: '/logos/ucu.webp'                       },
  { id: 'uc',       name: 'UC',       full: 'Universidad de Congreso',                                             province: 'Mendoza',         type: 'privada',   color: '#4B1A5B', logo: '/logos/uc.svg'                       },
  { id: 'uflo',     name: 'UFLO',     full: 'Universidad de Flores',                                               province: 'CABA',            type: 'privada',   color: '#1A5B2B', logo: '/logos/uflo.webp'                       },
  { id: 'um_mza',   name: 'UM',       full: 'Universidad de Mendoza',                                              province: 'Mendoza',         type: 'privada',   color: '#5B3B1A', logo: '/logos/um_mza.webp'                       },
  { id: 'um_moron', name: 'UdM',      full: 'Universidad de Morón',                                                province: 'Buenos Aires',    type: 'privada',   color: '#2B4B7B', logo: '/logos/um_moron.svg'                       },
  { id: 'up',       name: 'UP',       full: 'Universidad de Palermo',                                              province: 'CABA',            type: 'privada',   color: '#1A1A8B', logo: '/logos/up.svg'           },
  { id: 'udesa',    name: 'UdeSA',    full: 'Universidad de San Andrés',                                           province: 'Buenos Aires',    type: 'privada',   color: '#1A3B5B', logo: '/logos/udesa.svg'        },
  { id: 'usi',      name: 'USI',      full: 'Universidad de San Isidro',                                           province: 'Buenos Aires',    type: 'privada',   color: '#2B3B5B', logo: '/logos/usi.webp'                       },
  { id: 'uda',      name: 'UDA',      full: 'Universidad del Aconcagua',                                           province: 'Mendoza',         type: 'privada',   color: '#5B2B1A', logo: '/logos/uda.webp'                       },
  { id: 'ucema',    name: 'UCEMA',    full: 'Universidad del CEMA',                                                province: 'CABA',            type: 'privada',   color: '#1A2B3B', logo: '/logos/ucema.svg'        },
  { id: 'ucel',     name: 'UCEL',     full: 'Universidad del Centro Educativo Latinoamericano',                   province: 'Santa Fe',        type: 'privada',   color: '#2B5B3B', logo: '/logos/ucel.webp'                       },
  { id: 'ucine',    name: 'UCINE',    full: 'Universidad del Cine',                                                province: 'CABA',            type: 'privada',   color: '#4B1A3B', logo: '/logos/ucine.svg'                       },
  { id: 'ude',      name: 'UDE',      full: 'Universidad del Este',                                                province: 'Buenos Aires',    type: 'privada',   color: '#1A4B5B', logo: '/logos/ude.webp'                       },
  { id: 'ugr',      name: 'UGR',      full: 'Universidad del Gran Rosario',                                        province: 'Santa Fe',        type: 'privada',   color: '#2B5B4B', logo: '/logos/ugr.webp'                       },
  { id: 'umsa',     name: 'UMSA',     full: 'Universidad del Museo Social Argentino',                              province: 'CABA',            type: 'privada',   color: '#3B2B5B', logo: '/logos/umsa.webp'                       },
  { id: 'unsta',    name: 'UNSTA',    full: 'Universidad del Norte Santo Tomás de Aquino',                         province: 'Tucumán',         type: 'privada',   color: '#5B2B1A', logo: '/logos/unsta.webp'                       },
  { id: 'usal',     name: 'USAL',     full: 'Universidad del Salvador',                                            province: 'CABA',            type: 'privada',   color: '#1A3B5B', logo: '/logos/usal.svg'         },
  { id: 'ucp',      name: 'UCP',      full: 'Universidad de la Cuenca del Plata',                                  province: 'Corrientes',      type: 'privada',   color: '#1A5B3B', logo: '/logos/ucp.svg'                       },
  { id: 'udemm',    name: 'UdeMM',    full: 'Universidad de la Marina Mercante',                                   province: 'CABA',            type: 'privada',   color: '#1A2B4B', logo: '/logos/udemm.webp'                       },
  { id: 'uch',      name: 'UCH',      full: 'Universidad Champagnat',                                              province: 'Mendoza',         type: 'privada',   color: '#1A4B2B', logo: '/logos/uch.webp'                       },
  { id: 'ues21',    name: 'UES21',    full: 'Universidad Empresarial Siglo 21',                                    province: 'Córdoba',         type: 'privada',   color: '#1A1A4B', logo: '/logos/ues21.svg'        },
  { id: 'ufasta',   name: 'UFASTA',   full: 'Universidad FASTA',                                                   province: 'Buenos Aires',    type: 'privada',   color: '#1A4B5B', logo: '/logos/ufasta.webp'                       },
  { id: 'uf',       name: 'UF',       full: 'Universidad Favaloro',                                                province: 'CABA',            type: 'privada',   color: '#1A3B6B', logo: '/logos/uf.svg'           },
  { id: 'ugd',      name: 'UGD',      full: 'Universidad Gastón Dachary',                                          province: 'Misiones',        type: 'privada',   color: '#2B5B2B', logo: '/logos/ugd.webp'                       },
  { id: 'ui',       name: 'ISALUD',   full: 'Universidad ISALUD',                                                  province: 'CABA',            type: 'privada',   color: '#1A5B4B', logo: '/logos/isalud.svg'                       },
  { id: 'umaza',    name: 'UMAZA',    full: 'Universidad Juan Agustín Maza',                                       province: 'Mendoza',         type: 'privada',   color: '#4B3B1A', logo: '/logos/umaza.webp'                       },
  { id: 'umai',     name: 'UMAI',     full: 'Universidad Maimónides',                                              province: 'CABA',            type: 'privada',   color: '#2B1A4B', logo: '/logos/umai.svg'         },
  { id: 'umet',     name: 'UMET',     full: 'Universidad Metropolitana para la Educación y el Trabajo',            province: 'CABA',            type: 'privada',   color: '#1A4B3B', logo: '/logos/umet.webp'                       },
  { id: 'unisal',   name: 'UNISAL',   full: 'Universidad Salesiana',                                               province: 'Buenos Aires',    type: 'privada',   color: '#1A3B4B', logo: '/logos/unisal.webp'                       },
  { id: 'uspt',     name: 'USP-T',    full: 'Universidad San Pablo-T',                                             province: 'Tucumán',         type: 'privada',   color: '#4B1A2B', logo: '/logos/uspt.svg'                       },
  { id: 'utdt',     name: 'UTDT',     full: 'Universidad Torcuato Di Tella',                                       province: 'CABA',            type: 'privada',   color: '#1A2B5B', logo: '/logos/utdt.svg'         },
  { id: 'usba',     name: 'USBA',     full: 'Universidad del Sur de Buenos Aires',                                 province: 'CABA',            type: 'privada',   color: '#2B4B5B', logo: '/logos/usba.webp'                       },
  { id: 'unisud',   name: 'UNISUD',   full: 'Universidad de la Integración Sudamericana',                         province: 'Misiones',        type: 'privada',   color: '#1A5B2B', logo: '/logos/unisud.webp'                       },

  // ════════════════════════════════════════════
  // INSTITUTOS UNIVERSITARIOS
  // ════════════════════════════════════════════
  { id: 'iua',      name: 'IUA',      full: 'Instituto Universitario Aeronáutico',                                 province: 'Córdoba',         type: 'instituto', color: '#1A2B4B', logo: '/logos/iua.webp'                       },
  { id: 'iupfa',    name: 'IUPFA',    full: 'Instituto Universitario de la Policía Federal Argentina',             province: 'CABA',            type: 'instituto', color: '#1A1A5B', logo: '/logos/iupfa.webp'                       },
  { id: 'iugna',    name: 'IUGNA',    full: 'Instituto Universitario de Gendarmería Nacional',                     province: 'CABA',            type: 'instituto', color: '#1A3B2B', logo: '/logos/iugna.webp'                       },
  { id: 'cemic',    name: 'CEMIC',    full: 'Instituto Universitario CEMIC',                                       province: 'CABA',            type: 'instituto', color: '#1A4B5B', logo: '/logos/cemic.webp'                       },
  { id: 'hi',       name: 'Hosp. Italiano', full: 'Inst. Univ. del Hospital Italiano',                              province: 'CABA',       type: 'instituto', color: '#1A3B5B', logo: '/logos/hi.webp'                       },
]

// ── Facultades por universidad ────────────────────────────────────────────
// Usado como sugerencias en la interfaz de upload.
// El usuario siempre puede escribir una nueva que no esté en la lista.
export const FACULTIES = {
  UBA:    ['Derecho', 'Medicina', 'Ciencias Exactas y Naturales', 'Ciencias Económicas', 'Ingeniería', 'Arquitectura Diseño y Urbanismo', 'Filosofía y Letras', 'Ciencias Sociales', 'Farmacia y Bioquímica', 'Odontología', 'Psicología', 'Agronomía', 'Ciencias Veterinarias'],
  UNC:    ['Derecho', 'Medicina', 'Ciencias Económicas', 'Ciencias Exactas Físicas y Naturales', 'Arquitectura Urbanismo y Diseño', 'Ingeniería', 'Psicología', 'Filosofía y Humanidades', 'Ciencias Químicas', 'Ciencias Agropecuarias', 'Ciencias de la Comunicación', 'Lenguas', 'Matemática Astronomía Física y Computación', 'Artes', 'Odontología', 'Ciencias Sociales'],
  UNLP:   ['Derecho', 'Medicina', 'Ciencias Económicas', 'Ciencias Exactas', 'Ingeniería', 'Arquitectura y Urbanismo', 'Humanidades y Ciencias de la Educación', 'Ciencias Jurídicas y Sociales', 'Informática', 'Periodismo y Comunicación Social', 'Psicología', 'Trabajo Social', 'Ciencias Agrarias y Forestales', 'Ciencias Naturales y Museo', 'Ciencias Veterinarias', 'Artes'],
  UTN:    ['Ingeniería en Sistemas', 'Ingeniería Civil', 'Ingeniería Electrónica', 'Ingeniería Eléctrica', 'Ingeniería Mecánica', 'Ingeniería Industrial', 'Ingeniería Química', 'Ingeniería en Construcciones', 'Administración y Organización Industrial'],
  UNR:    ['Medicina', 'Derecho', 'Ciencias Económicas y Estadística', 'Ingeniería', 'Cs. Exactas Ingeniería y Agrimensura', 'Arquitectura Planeamiento y Diseño', 'Humanidades y Artes', 'Cs. Políticas y RR.II.', 'Bioquímica y Farmacéutica', 'Odontología', 'Psicología', 'Ciencias Veterinarias', 'Agronomía'],
  UNT:    ['Medicina', 'Ingeniería', 'Exactas y Tecnología', 'Derecho y Ciencias Sociales', 'Ciencias Económicas', 'Filosofía y Letras', 'Bioquímica Química y Farmacia', 'Odontología', 'Agronomía y Zootecnia', 'Arquitectura y Urbanismo', 'Artes'],
  UNCuyo: ['Ingeniería', 'Ciencias Económicas', 'Derecho', 'Ciencias Médicas', 'Ciencias Exactas y Naturales', 'Filosofía y Letras', 'Ciencias Políticas y Sociales', 'Educación', 'Odontología', 'Artes y Diseño', 'Ciencias Agrarias'],
  UNS:    ['Ingeniería', 'Ciencias', 'Economía y Administración', 'Derecho', 'Humanidades', 'Cs. de la Educación y Cs. Sociales', 'Agronomía', 'Medicina'],
  UNNE:   ['Medicina', 'Derecho Ciencias Sociales y Políticas', 'Ingeniería', 'Ciencias Exactas y Naturales y Agrimensura', 'Ciencias Económicas', 'Humanidades', 'Arquitectura y Urbanismo', 'Odontología', 'Veterinaria', 'Agroindustrias'],
  UNMdP:  ['Ingeniería', 'Arquitectura Urbanismo y Diseño', 'Ciencias Económicas y Sociales', 'Humanidades', 'Ciencias Exactas y Naturales', 'Ciencias de la Salud y Trabajo Social', 'Derecho', 'Psicología', 'Ciencias Agrarias'],
  UNSa:   ['Ciencias Naturales', 'Ciencias de la Salud', 'Ingeniería', 'Ciencias Jurídicas', 'Ciencias Económicas Jurídicas y Sociales', 'Humanidades'],
  UNSJ:   ['Ingeniería', 'Ciencias Sociales', 'Arquitectura Urbanismo y Diseño', 'Filosofía Humanidades y Artes', 'Ciencias Exactas Físicas y Naturales'],
  UNSL:   ['Ingeniería y Ciencias Agropecuarias', 'Ciencias Físico Matemáticas y Naturales', 'Ciencias Económicas Jurídicas y Sociales', 'Psicología'],
  UNSE:   ['Ciencias Exactas y Tecnologías', 'Ciencias Forestales', 'Humanidades Ciencias Sociales y de la Salud', 'Ciencias Médicas'],
  UNCo:   ['Ciencias Agrarias', 'Ciencias de la Educación', 'Economía y Administración', 'Cs. del Ambiente y la Salud', 'Humanidades', 'Informática', 'Ingeniería', 'Cs. del Ambiente y la Salud', 'Turismo'],
  UNLaM:  ['Ingeniería', 'Humanidades y Ciencias Sociales', 'Ciencias Económicas', 'Derecho'],
  UNQ:    ['Ciencias Naturales y Exactas', 'Ciencias Sociales', 'Economia y Administración', 'Arte y Cultura Digital'],
  UNTREF: ['Artes y Cultura', 'Ciencias Sociales', 'Ciencias de la Salud', 'Ingeniería e Investigación Tecnológica', 'Formación Continua'],
  UNSAM:  ['Ciencias Exactas y Naturales', 'Humanidades', 'Ingeniería', 'Arte y Patrimonio', 'Ciencias Económicas'],
  UNER:   ['Trabajo Social', 'Ciencias Económicas', 'Ingeniería', 'Cs. de la Educación', 'Bromatología', 'Ciencias de la Administración', 'Ciencias de la Salud', 'Cs. Agropecuarias'],
  UNJu:   ['Ciencias Agrarias', 'Ciencias Económicas', 'Ciencias de la Salud', 'Humanidades y Ciencias Sociales', 'Ingeniería'],
  UNCA:   ['Ciencias Agrarias', 'Ciencias Económicas y de Administración', 'Ciencias de la Salud', 'Humanidades', 'Tecnología y Ciencias Aplicadas'],
  UNRC:   ['Agronomía y Veterinaria', 'Ciencias Económicas', 'Ciencias Exactas Físico-Químicas y Naturales', 'Cs. Humanas', 'Ingeniería'],
  UNICEN: ['Ciencias Exactas', 'Cs. Humanas', 'Arte', 'Ciencias de la Salud', 'Cs. Veterinarias', 'Agronomía', 'Ingeniería'],
  UNLu:   ['Ciencias Básicas', 'Cs. Sociales', 'Educación', 'Ingeniería'],
  UNaM:   ['Arte y Diseño', 'Ciencias Económicas', 'Ciencias Exactas Químicas y Naturales', 'Ciencias Forestales', 'Humanidades y Ciencias Sociales', 'Ingeniería'],
  UNF:    ['Cs. de Gestión', 'Cs. de la Salud', 'Humanidades y Ciencias Sociales', 'Recursos Naturales'],
  UNLPam: ['Agronomía', 'Ciencias Económicas y Jurídicas', 'Ciencias Exactas y Naturales', 'Cs. Humanas', 'Ingeniería'],
  UNVM:   ['Cs. Básicas y Aplicadas', 'Cs. Humanas', 'Cs. Sociales'],
  UNRN:   ['Derecho y Ciencias Sociales', 'Cs. del Ambiente y la Salud', 'Ingeniería', 'Artes y Medios', 'Ciencias Económicas y Empresariales', 'Informática'],
  UNNOBA: ['Informática', 'Agronomía', 'Ingeniería', 'Cs. Económicas y Jurídicas', 'Humanidades y Salud'],
  // Privadas principales
  ITBA:   ['Ingeniería', 'Ingeniería Informática', 'Ingeniería Industrial', 'Administración y Negocios', 'Maestrías'],
  UADE:   ['Ciencias Económicas', 'Ciencias Jurídicas y Sociales', 'Ciencias de la Salud', 'Ingeniería y Ciencias Exactas', 'Comunicación', 'Arquitectura y Diseño'],
  UCA:    ['Ciencias Económicas', 'Derecho', 'Ciencias Médicas', 'Ciencias Sociales', 'Ingeniería', 'Filosofía y Letras', 'Psicología y Psicopedagogía', 'Teología'],
  UCC:    ['Derecho', 'Ciencias Económicas', 'Ingeniería', 'Cs. Agropecuarias', 'Arquitectura y Diseño', 'Filosofía y Humanidades', 'Educación', 'Ciencias de la Salud'],
  UB:     ['Arquitectura y Urbanismo', 'Cs. Económicas', 'Derecho y Cs. Sociales', 'Humanidades', 'Ingeniería', 'Cs. Exactas y Naturales', 'Cs. de la Salud'],
  USAL:   ['Ciencias Económicas', 'Derecho', 'Ciencias Sociales', 'Filosofía', 'Ingeniería', 'Medicina', 'Psicología'],
  UP:     ['Administración de Empresas', 'Derecho', 'Diseño y Comunicación', 'Ingeniería', 'Ciencias Sociales', 'Humanidades y Educación'],
  UTDT:   ['Derecho', 'Ciencias Empresariales', 'Ingeniería y Ciencias Exactas', 'Arquitectura y Estudios Urbanos', 'Gobierno y Relaciones Internacionales'],
  UF:     ['Medicina', 'Ingeniería', 'Nutrición'],
  UCEMA:  ['Economía', 'Ingeniería', 'Negocios'],
  UES21:  ['Negocios', 'Derecho', 'Comunicación', 'Ingeniería y Tecnología', 'Diseño y Comunicación Visual'],
}

// ── Helpers ───────────────────────────────────────────────────────────────

/** Devuelve todas las universidades ordenadas por tipo y nombre */
export function getAll() {
  return UNIVERSITIES
}

/** Devuelve solo las nacionales */
export function getNacionales() {
  return UNIVERSITIES.filter(u => u.type === 'nacional')
}

/** Devuelve solo las privadas */
export function getPrivadas() {
  return UNIVERSITIES.filter(u => u.type === 'privada')
}

/** Devuelve las facultades sugeridas para una universidad */
export function getFacultades(acronym) {
  return FACULTIES[acronym] ?? []
}

/** Para el UNI_LIST del upload */
export function toUploadList() {
  return UNIVERSITIES.map(u => ({ id: u.id, name: u.name, full: u.full, province: u.province, type: u.type }))
}
