// IntegrationModal reuses ComponentsModal with type="integration"
import ComponentsModal from './ComponentsModal';
export default function IntegrationModal({ system, onClose }) {
  return <ComponentsModal system={system} type="integration" onClose={onClose} />;
}
