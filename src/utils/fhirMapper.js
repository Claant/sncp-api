// utils/fhirMapper.js
import mongoose from 'mongoose';

/**
 * Motor de Interoperabilidad HL7 FHIR - Proyecto de Título
 * Convierte dinámicamente registros documentales JSON (Locales o Externos) en un Bundle oficial.
 */
export const construirFHIRBundle = (paciente, atenciones = [], diagnosticos = []) => {
    const fhirBundle = {
        resourceType: "Bundle",
        type: "collection",
        id: `bundle-clinico-${paciente?._id || new mongoose.Types.ObjectId()}`,
        timestamp: new Date().toISOString(),
        entry: []
    };

    if (!paciente) return fhirBundle;

    // 1. Mapear Recurso Core: Patient
    fhirBundle.entry.push({
        fullUrl: `urn:uuid:${paciente._id}`,
        resource: {
            resourceType: "Patient",
            id: paciente._id.toString(),
            identifier: [
                {
                    use: "official",
                    system: "https://registrocivil.cl", // Formato oficial chileno
                    value: paciente.rut
                }
            ],
            name: [{ use: "official", text: paciente.nombre }],
            birthDate: paciente.fecha_nacimiento ? new Date(paciente.fecha_nacimiento).toISOString().split('T')[0] : undefined,
            address: paciente.direccion_id ? [{
                line: [paciente.direccion_id.calle || "Dirección registrada"],
                city: paciente.direccion_id.ciudad || paciente.direccion_id.city || "Comuna",
                country: "Chile"
              }] : []
        }
    });

    // 2. Mapear Arreglo de Recursos: Encounter (Atenciones Médicas)
    atenciones.forEach((atn) => {
        fhirBundle.entry.push({
            fullUrl: `urn:uuid:${atn._id}`,
            resource: {
                resourceType: "Encounter",
                id: atn._id.toString(),
                status: "finished",
                class: {
                    system: "http://hl7.org",
                    code: "AMB",
                    display: "ambulatory"
                },
                subject: { reference: `Patient/${paciente._id}` },
                period: { start: atn.fecha || atn.createdAt },
                reasonCode: [{ text: atn.motivo_consulta || "Consulta médica asistencial" }],
                participant: atn.usuario_id ? [{
                    individual: {
                        reference: `Practitioner/${atn.usuario_id._id || atn.usuario_id}`,
                        display: atn.usuario_id.nombre ? `${atn.usuario_id.nombre} - ${atn.usuario_id.especialidad || 'General'}` : "Médico de Turno"
                    }
                }] : []
            }
        });
    });

    // 3. Mapear Arreglo de Recursos: Condition (Diagnósticos CIE-10)
    diagnosticos.forEach((diag) => {
        fhirBundle.entry.push({
            fullUrl: `urn:uuid:${diag._id}`,
            resource: {
                resourceType: "Condition",
                id: diag._id.toString(),
                clinicalStatus: {
                    coding: [{ system: "http://hl7.org", code: "active" }]
                },
                code: {
                    coding: [
                        {
                            system: "http://hl7.org", // Estándar exigido en Chile por el Minsal
                            code: diag.codigo_enfermedad || "N39.0",
                            display: diag.descripcion || "Sin descripción"
                        }
                    ]
                },
                subject: { reference: `Patient/${paciente._id}` },
                encounter: { reference: `Encounter/${diag.atencion_id}` }
            }
        });
    });

    return fhirBundle;
};
